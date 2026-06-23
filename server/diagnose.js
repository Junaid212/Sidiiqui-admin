// Diagnostic script — run with: node diagnose.js
// Tests Supabase connection and checks questionnaire data
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\n========================================');
console.log('QUESTIONNAIRE DIAGNOSTICS');
console.log('========================================\n');

if (!url || !key) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

console.log('✅ Supabase URL:', url);
console.log('✅ Key starts with:', key.substring(0, 20) + '...\n');

const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
    // 1. Count total submissions
    console.log('--- CHECKING TABLE ---');
    const { count, error: countErr } = await supabase
        .from('questionnaire_submissions')
        .select('*', { count: 'exact', head: true });

    if (countErr) {
        console.error('❌ Error counting rows:', countErr.message);
        console.error('   Code:', countErr.code);
        console.error('   Details:', countErr.details);
    } else {
        console.log('✅ Total rows in questionnaire_submissions:', count);
    }

    // 2. Fetch first 3 rows to inspect columns
    console.log('\n--- FETCHING SAMPLE ROWS ---');
    const { data: rows, error: rowsErr } = await supabase
        .from('questionnaire_submissions')
        .select('*')
        .limit(3)
        .order('created_at', { ascending: false });

    if (rowsErr) {
        console.error('❌ Error fetching rows:', rowsErr.message);
        console.error('   Code:', rowsErr.code);
        if (rowsErr.code === '42703') {
            console.error('\n   ⚠️  COLUMN DOES NOT EXIST!');
            console.error('   You need to run the ALTER TABLE SQL in Supabase.');
        }
    } else if (!rows || rows.length === 0) {
        console.log('⚠️  No rows found in questionnaire_submissions table.');
        console.log('   This means NO submissions have been saved successfully.');
        console.log('   The frontend is likely getting a 500 error when submitting.');
    } else {
        console.log(`✅ Found ${rows.length} sample row(s):\n`);
        rows.forEach((row, i) => {
            console.log(`Row ${i + 1}:`);
            console.log('  id:', row.id);
            console.log('  profile:', row.profile);
            console.log('  total_score:', row.total_score ?? 'MISSING (column not added yet)');
            console.log('  perception_category:', row.perception_category ?? 'MISSING (column not added yet)');
            console.log('  created_at:', row.created_at);
            console.log('  answers keys:', Object.keys(row.answers || {}));
            console.log('');
        });
    }

    // 3. Check if columns exist by looking at table info
    console.log('\n--- CHECKING COLUMNS ---');
    const { data: colData, error: colErr } = await supabase
        .from('questionnaire_submissions')
        .select('id, profile, answers, total_score, perception_category')
        .limit(1);

    if (colErr) {
        if (colErr.code === '42703') {
            console.error('❌ COLUMN MISSING! Error:', colErr.message);
            console.error('\n🔧 FIX: Run this SQL in your Supabase SQL Editor:');
            console.error('   ALTER TABLE questionnaire_submissions ADD COLUMN IF NOT EXISTS total_score INTEGER NOT NULL DEFAULT 0;');
            console.error('   ALTER TABLE questionnaire_submissions ADD COLUMN IF NOT EXISTS perception_category TEXT;');
        } else {
            console.error('❌ Column check error:', colErr.message);
        }
    } else {
        console.log('✅ All required columns exist (id, profile, answers, total_score, perception_category)');
    }

    // 4. Test a dummy insert (then rollback by deleting)
    console.log('\n--- TESTING INSERT ---');
    const testData = {
        profile: 'TEST_DIAGNOSTIC',
        answers: { q1: { option_text: 'Test', question_text: 'Test Q', score: 3, option_index: 4 } },
        total_score: 3,
        perception_category: 'Value Thinker',
        voter_ip: '127.0.0.1',
        session_id: 'DIAGNOSTIC_TEST'
    };

    const { data: inserted, error: insertErr } = await supabase
        .from('questionnaire_submissions')
        .insert([testData])
        .select('id')
        .single();

    if (insertErr) {
        console.error('❌ INSERT FAILED:', insertErr.message);
        console.error('   Code:', insertErr.code);
        if (insertErr.code === '42703') {
            console.error('\n   ⚠️  Columns are MISSING. Run the ALTER TABLE SQL first!');
        }
    } else {
        console.log('✅ Test insert succeeded! ID:', inserted.id);

        // Clean up the test row
        await supabase.from('questionnaire_submissions').delete().eq('id', inserted.id);
        console.log('✅ Test row cleaned up');
    }

    // 5. Check if RLS is blocking reads
    console.log('\n--- CHECKING RLS POLICIES ---');
    const { data: policies, error: polErr } = await supabase.rpc('get_policies', {}).catch(() => ({ data: null, error: { message: 'RPC not available' } }));
    console.log('   (RLS check via service role — service role bypasses RLS so reads should always work)');

    console.log('\n========================================');
    console.log('DIAGNOSTICS COMPLETE');
    console.log('========================================\n');
}

run().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
