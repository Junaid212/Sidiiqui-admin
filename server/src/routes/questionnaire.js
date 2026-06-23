const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

// ─── Category ranges (mirrors frontend + main backend logic) ──────────────
const CATEGORIES = [
    { name: 'Promotional Thinker',      color: '#f97316', emoji: '📢' },
    { name: 'Sales Thinker',            color: '#eab308', emoji: '📈' },
    { name: 'Value Thinker',            color: '#22c55e', emoji: '💡' },
    { name: 'Strategic Value Architect',color: '#ef4444', emoji: '🏛️' },
];

const CATEGORY_RANGES = [
    { name: "Promotional Thinker", min: 0,  max: 2 },
    { name: "Sales Thinker",       min: 3,  max: 5 },
    { name: "Value Thinker",       min: 6,  max: 7 },
    { name: "Strategic Value Architect", min: 8, max: 9 },
];

function computeCategory(totalScore) {
    const cat = CATEGORY_RANGES.find((c) => totalScore >= c.min && totalScore <= c.max);
    return cat ? cat.name : "Promotional Thinker";
}

// ─── GET /api/questionnaire/analytics ────────────────────────────────────
// Full dashboard data: totals, profile breakdown, category breakdown, Q results
router.get('/analytics', async (req, res) => {
    try {
        // Total submissions
        const { count: totalSubmissions, error: countError } = await supabaseAdmin
            .from('questionnaire_submissions')
            .select('*', { count: 'exact', head: true });

        if (countError) return res.status(500).json({ error: countError.message });

        // Fetch all submissions for aggregation (safely select * so it doesn't fail if total_score/perception_category are missing)
        const { data: allRows, error: allError } = await supabaseAdmin
            .from('questionnaire_submissions')
            .select('*');

        if (allError) return res.status(500).json({ error: allError.message });

        // Map and compute total_score and perception_category dynamically if missing in DB
        const rows = (allRows || []).map(r => {
            const answers = r.answers || {};
            const total_score = r.total_score !== undefined && r.total_score !== null 
                ? r.total_score 
                : Object.values(answers).reduce((sum, a) => sum + (a?.score || 0), 0);
            const perception_category = r.perception_category || computeCategory(total_score);
            return {
                ...r,
                total_score,
                perception_category
            };
        });

        // ── Profile breakdown ──────────────────────────────────────────
        const profileCounts = {};
        for (const r of rows) {
            const k = r.profile || 'Unknown';
            profileCounts[k] = (profileCounts[k] || 0) + 1;
        }
        const profileBreakdown = Object.entries(profileCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([profile, count]) => ({
                profile,
                count,
                percentage: totalSubmissions > 0 ? Math.round((count / totalSubmissions) * 100) : 0,
            }));

        // ── Perception category breakdown ──────────────────────────────
        const catCounts = {};
        for (const r of rows) {
            const k = r.perception_category || 'Unknown';
            catCounts[k] = (catCounts[k] || 0) + 1;
        }
        const categoryBreakdown = CATEGORIES
            .map((cat) => {
                const count = catCounts[cat.name] || 0;
                return {
                    category: cat.name,
                    emoji: cat.emoji,
                    color: cat.color,
                    count,
                    percentage: totalSubmissions > 0 ? Math.round((count / totalSubmissions) * 100) : 0,
                };
            });

        // ── Per-question aggregation from JSONB ────────────────────────
        const questionAgg = {};
        const questionText = {};
        for (const row of rows) {
            const answers = row.answers || {};
            for (const [qKey, ans] of Object.entries(answers)) {
                if (!questionAgg[qKey]) questionAgg[qKey] = {};
                if (!questionText[qKey] && ans.question_text) questionText[qKey] = ans.question_text;
                const optText = ans.option_text || String(ans);
                questionAgg[qKey][optText] = (questionAgg[qKey][optText] || 0) + 1;
            }
        }

        const questionResults = Object.entries(questionAgg)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([qKey, optCounts]) => {
                const totalVotes = Object.values(optCounts).reduce((s, c) => s + c, 0);
                return {
                    key: qKey,
                    question_text: questionText[qKey] || qKey,
                    total_votes: totalVotes,
                    options: Object.entries(optCounts)
                        .sort((a, b) => b[1] - a[1])
                        .map(([optText, count]) => ({
                            option_text: optText,
                            votes: count,
                            percentage: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
                        })),
                };
            });

        return res.status(200).json({
            total_submissions: totalSubmissions || 0,
            profile_breakdown: profileBreakdown,
            category_breakdown: categoryBreakdown,
            questions: questionResults,
        });
    } catch (err) {
        console.error('[questionnaire] analytics error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET /api/questionnaire/submissions ──────────────────────────────────
// Paginated + filtered list of submissions
router.get('/submissions', async (req, res) => {
    const {
        page = 1, limit = 25,
        profile, category, search, dateFrom, dateTo,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    try {
        let query = supabaseAdmin
            .from('questionnaire_submissions')
            .select('*')
            .order('created_at', { ascending: false });

        if (profile)   query = query.eq('profile', profile);
        if (dateFrom)  query = query.gte('created_at', dateFrom);
        if (dateTo)    query = query.lte('created_at', dateTo + 'T23:59:59Z');

        const { data, error } = await query;
        if (error) return res.status(500).json({ error: error.message });

        let rows = (data || []).map(r => {
            const answers = r.answers || {};
            const total_score = r.total_score !== undefined && r.total_score !== null 
                ? r.total_score 
                : Object.values(answers).reduce((sum, a) => sum + (a?.score || 0), 0);
            const perception_category = r.perception_category || computeCategory(total_score);
            return {
                ...r,
                total_score,
                perception_category
            };
        });

        if (category) {
            rows = rows.filter(r => r.perception_category === category);
        }

        if (search) {
            const term = search.toLowerCase();
            rows = rows.filter(
                (r) =>
                    (r.profile || '').toLowerCase().includes(term) ||
                    (r.perception_category || '').toLowerCase().includes(term) ||
                    (r.id || '').toLowerCase().includes(term)
            );
        }

        const total = rows.length;
        const paginated = rows.slice(offset, offset + limitNum);

        return res.status(200).json({
            submissions: paginated,
            total: total,
            page: pageNum,
            limit: limitNum,
            total_pages: Math.ceil(total / limitNum),
        });
    } catch (err) {
        console.error('[questionnaire] submissions error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET /api/questionnaire/profiles ─────────────────────────────────────
router.get('/profiles', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('questionnaire_submissions')
            .select('profile');
        if (error) return res.status(500).json({ error: error.message });
        const profiles = [...new Set((data || []).map((r) => r.profile).filter(Boolean))].sort();
        return res.status(200).json({ profiles });
    } catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET /api/questionnaire/export/csv ───────────────────────────────────
router.get('/export/csv', async (req, res) => {
    const { profile, category, search, dateFrom, dateTo } = req.query;

    try {
        let query = supabaseAdmin
            .from('questionnaire_submissions')
            .select('*')
            .order('created_at', { ascending: false });

        if (profile)   query = query.eq('profile', profile);
        if (dateFrom)  query = query.gte('created_at', dateFrom);
        if (dateTo)    query = query.lte('created_at', dateTo + 'T23:59:59Z');

        const { data, error } = await query;
        if (error) return res.status(500).json({ error: error.message });

        let rows = (data || []).map(r => {
            const answers = r.answers || {};
            const total_score = r.total_score !== undefined && r.total_score !== null 
                ? r.total_score 
                : Object.values(answers).reduce((sum, a) => sum + (a?.score || 0), 0);
            const perception_category = r.perception_category || computeCategory(total_score);
            return {
                ...r,
                total_score,
                perception_category
            };
        });

        if (category) {
            rows = rows.filter(r => r.perception_category === category);
        }

        if (search) {
            const term = search.toLowerCase();
            rows = rows.filter(
                (r) =>
                    (r.profile || '').toLowerCase().includes(term) ||
                    (r.perception_category || '').toLowerCase().includes(term) ||
                    (r.id || '').toLowerCase().includes(term)
            );
        }

        // Build question headers from first row
        const qKeys = rows.length > 0
            ? Object.keys(rows[0].answers || {}).sort()
            : ['q1', 'q2', 'q3'];

        const getQuestionHeader = (row, key) => {
            const a = (row.answers || {})[key];
            return a ? a.question_text || key : key;
        };

        // Use first row to get question text for headers
        const firstRow = rows[0] || {};
        const qHeaders = qKeys.map((k) => `"${(getQuestionHeader(firstRow, k) || k).replace(/"/g, '""')}"`);

        const csvHeader = [
            'Submission ID', 'Date & Time', 'Profile / Category',
            'Perception Category', 'Score',
            ...qHeaders,
            'IP Address', 'Session ID',
        ].join(',');

        const csvRows = rows.map((row) => {
            const answers = row.answers || {};
            const answerCols = qKeys.map((k) => {
                const a = answers[k];
                const text = a ? a.option_text : '';
                return `"${text.replace(/"/g, '""')}"`;
            });
            return [
                `"${row.id}"`,
                `"${new Date(row.created_at).toLocaleString()}"`,
                `"${(row.profile || '').replace(/"/g, '""')}"`,
                `"${(row.perception_category || '').replace(/"/g, '""')}"`,
                row.total_score || 0,
                ...answerCols,
                `"${row.voter_ip || ''}"`,
                `"${row.session_id || ''}"`,
            ].join(',');
        });

        const csv = [csvHeader, ...csvRows].join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="questionnaire_${Date.now()}.csv"`);
        return res.send('\uFEFF' + csv);
    } catch (err) {
        console.error('[questionnaire] CSV error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET /api/questionnaire/export/excel ─────────────────────────────────
router.get('/export/excel', async (req, res) => {
    const { profile, category, search, dateFrom, dateTo } = req.query;

    try {
        let ExcelJS;
        try { ExcelJS = require('exceljs'); }
        catch (e) { return res.status(501).json({ error: 'Install exceljs: npm install exceljs' }); }

        let query = supabaseAdmin
            .from('questionnaire_submissions')
            .select('*')
            .order('created_at', { ascending: false });

        if (profile)   query = query.eq('profile', profile);
        if (dateFrom)  query = query.gte('created_at', dateFrom);
        if (dateTo)    query = query.lte('created_at', dateTo + 'T23:59:59Z');

        const { data, error } = await query;
        if (error) return res.status(500).json({ error: error.message });

        let rows = (data || []).map(r => {
            const answers = r.answers || {};
            const total_score = r.total_score !== undefined && r.total_score !== null 
                ? r.total_score 
                : Object.values(answers).reduce((sum, a) => sum + (a?.score || 0), 0);
            const perception_category = r.perception_category || computeCategory(total_score);
            return {
                ...r,
                total_score,
                perception_category
            };
        });

        if (category) {
            rows = rows.filter(r => r.perception_category === category);
        }

        if (search) {
            const term = search.toLowerCase();
            rows = rows.filter(
                (r) =>
                    (r.profile || '').toLowerCase().includes(term) ||
                    (r.perception_category || '').toLowerCase().includes(term) ||
                    (r.id || '').toLowerCase().includes(term)
            );
        }

        const qKeys = rows.length > 0 ? Object.keys(rows[0].answers || {}).sort() : ['q1', 'q2', 'q3'];
        const firstRow = rows[0] || {};

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Siddiqui Digital Admin';
        const sheet = workbook.addWorksheet('Submissions');

        const qCols = qKeys.map((k) => {
            const a = (firstRow.answers || {})[k];
            return { header: a?.question_text || k, key: k, width: 45 };
        });

        sheet.columns = [
            { header: 'Submission ID',       key: 'id',                  width: 38 },
            { header: 'Date & Time',          key: 'created_at',          width: 22 },
            { header: 'Professional Profile', key: 'profile',             width: 28 },
            { header: 'Perception Category',  key: 'perception_category', width: 26 },
            { header: 'Score',                key: 'total_score',         width: 8  },
            ...qCols,
            { header: 'IP Address',           key: 'voter_ip',            width: 18 },
            { header: 'Session ID',           key: 'session_id',          width: 28 },
        ];

        // Style header
        const hRow = sheet.getRow(1);
        hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
        hRow.alignment = { vertical: 'middle' };
        hRow.height = 22;

        for (const row of rows) {
            const answers = row.answers || {};
            const rowData = {
                id: row.id,
                created_at: new Date(row.created_at).toLocaleString(),
                profile: row.profile || '',
                perception_category: row.perception_category || '',
                total_score: row.total_score || 0,
                voter_ip: row.voter_ip || '',
                session_id: row.session_id || '',
            };
            for (const k of qKeys) {
                const a = answers[k];
                rowData[k] = a ? a.option_text : '';
            }
            sheet.addRow(rowData);
        }

        sheet.eachRow((row, rowNum) => {
            if (rowNum > 1) {
                row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowNum % 2 === 0 ? 'FFF9FAFB' : 'FFFFFFFF' } };
            }
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="questionnaire_${Date.now()}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('[questionnaire] Excel error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
