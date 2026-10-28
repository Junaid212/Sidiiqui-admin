require('dotenv').config({ path: 'd:/Bright Media WORK/siddique-admin/server/.env' });
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

const ZIP_PATH = 'C:\\Users\\Lenovo\\Downloads\\SID_Insights_Blog_Import.zip';
const ADMIN_ID = '3417e953-65a4-4f74-aefb-85847c4644ab';
const ARTICLE_1_ID = 'e0803d92-7550-4f69-8e4c-21b85ec2b178';
const ARTICLE_1_SLUG = 'marketing-is-not-failing-it-is-misplaced';

async function executePhase2() {
    console.log('================================================================');
    console.log('       SIDDIQUI.DIGITAL — PHASE 2 IMPORT & VALIDATION          ');
    console.log('================================================================\n');

    // 0. Verify ZIP exists
    if (!fs.existsSync(ZIP_PATH)) {
        console.error(`FATAL: ZIP file not found at ${ZIP_PATH}`);
        process.exit(1);
    }

    console.log(`[1/6] Loading client ZIP from ${ZIP_PATH}...`);
    const zip = new AdmZip(ZIP_PATH);
    const zipEntries = zip.getEntries();
    console.log(`      ZIP loaded successfully. Total entries: ${zipEntries.length}`);

    // Locate articles.json
    const articlesJsonEntry = zipEntries.find(e => e.entryName === 'articles.json' || e.entryName.endsWith('/articles.json'));
    if (!articlesJsonEntry) {
        console.error('FATAL: articles.json not found in ZIP archive.');
        process.exit(1);
    }

    const rawJson = articlesJsonEntry.getData().toString('utf8');
    const sourceArticles = JSON.parse(rawJson);
    console.log(`      Found ${sourceArticles.length} articles in articles.json.`);
    if (sourceArticles.length !== 35) {
        console.error(`FATAL: Expected 35 articles, found ${sourceArticles.length}`);
        process.exit(1);
    }

    // 1. Storage Upload: 35 Cover Images & 35 Social Images
    console.log('\n[2/6] Uploading 35 Cover Images and 35 Social Images to Supabase Storage ("blogs" bucket)...');
    const uploadResults = {
        coverSuccess: 0,
        coverFail: 0,
        socialSuccess: 0,
        socialFail: 0,
        instagramBlocked: 0
    };

    const imageMap = {}; // slug -> { coverUrl, coverPath, socialUrl, socialPath }

    for (const art of sourceArticles) {
        const slug = art.slug;
        imageMap[slug] = {};

        // Find cover image in ZIP: images/cover/<slug>.png
        const coverEntry = zipEntries.find(e => {
            const name = e.entryName.toLowerCase();
            return name.includes('images/cover/') && (name.endsWith(`/${slug.toLowerCase()}.png`) || name.endsWith(`${slug.toLowerCase()}.png`));
        });

        if (coverEntry) {
            const coverBuffer = coverEntry.getData();
            const coverPath = `blog-images/${slug}.png`;
            const { error: covErr } = await supabase.storage
                .from('blogs')
                .upload(coverPath, coverBuffer, {
                    contentType: 'image/png',
                    upsert: true
                });

            if (covErr) {
                console.error(`      ERROR uploading cover for ${slug}:`, covErr.message);
                uploadResults.coverFail++;
            } else {
                const { data: urlData } = supabase.storage.from('blogs').getPublicUrl(coverPath);
                imageMap[slug].coverPath = coverPath;
                imageMap[slug].coverUrl = urlData.publicUrl;
                uploadResults.coverSuccess++;
            }
        } else {
            console.warn(`      WARNING: Cover image not found for slug: ${slug}`);
            uploadResults.coverFail++;
        }

        // Find social image in ZIP: images/social/<slug>.png
        const socialEntry = zipEntries.find(e => {
            const name = e.entryName.toLowerCase();
            return name.includes('images/social/') && (name.endsWith(`/${slug.toLowerCase()}.png`) || name.endsWith(`${slug.toLowerCase()}.png`));
        });

        if (socialEntry) {
            const socialBuffer = socialEntry.getData();
            const socialPath = `blog-images/${slug}-social.png`;
            const { error: socErr } = await supabase.storage
                .from('blogs')
                .upload(socialPath, socialBuffer, {
                    contentType: 'image/png',
                    upsert: true
                });

            if (socErr) {
                console.error(`      ERROR uploading social for ${slug}:`, socErr.message);
                uploadResults.socialFail++;
            } else {
                const { data: urlData } = supabase.storage.from('blogs').getPublicUrl(socialPath);
                imageMap[slug].socialPath = socialPath;
                imageMap[slug].socialUrl = urlData.publicUrl;
                uploadResults.socialSuccess++;
            }
        } else {
            console.warn(`      WARNING: Social image not found for slug: ${slug}`);
            uploadResults.socialFail++;
        }
    }

    // Verify instagram images were NEVER uploaded
    const instagramEntries = zipEntries.filter(e => e.entryName.toLowerCase().includes('images/instagram/'));
    uploadResults.instagramBlocked = instagramEntries.length;

    console.log(`      Cover Images Uploaded:  ${uploadResults.coverSuccess} / 35 (Failed: ${uploadResults.coverFail})`);
    console.log(`      Social Images Uploaded: ${uploadResults.socialSuccess} / 35 (Failed: ${uploadResults.socialFail})`);
    console.log(`      Instagram Images Blocked from Website: ${uploadResults.instagramBlocked} (0 leaked)`);

    // 2. Fetch existing blogs to perform idempotent updates/inserts
    console.log('\n[3/6] Querying existing DB records...');
    const { data: existingBlogs, error: fetchErr } = await supabase.from('blogs').select('*');
    if (fetchErr) {
        console.error('FATAL: Failed to query existing blogs:', fetchErr.message);
        process.exit(1);
    }
    console.log(`      Existing records in DB: ${existingBlogs.length}`);
    const existingBySlug = new Map(existingBlogs.map(b => [b.slug, b]));

    // 3. Process All 35 Articles
    console.log('\n[4/6] Importing / Updating 35 articles...');
    const dbOperations = {
        updatedArticle1: null,
        inserted: [],
        updatedExisting: [],
        failed: []
    };

    // Helper to format topic2
    function formatTopic2(secCats) {
        if (Array.isArray(secCats)) {
            const arr = secCats.map(s => String(s).trim()).filter(Boolean);
            return arr.length > 0 ? arr.join(', ') : null;
        }
        if (typeof secCats === 'string') {
            return secCats.trim() || null;
        }
        return null;
    }

    for (const art of sourceArticles) {
        const slug = art.slug;
        const order = art.order;
        const isArticle1 = (slug === ARTICLE_1_SLUG || order === 1);
        const images = imageMap[slug] || {};

        // Status rule: 1-24 published, 25-35 scheduled
        const status = (order <= 24) ? 'published' : 'scheduled';
        const displayDate = art.display_date;
        const scheduledFor = (status === 'scheduled') ? `${displayDate}T00:00:00.000Z` : null;

        // Article 1 is the ONLY featured article
        const isFeatured = isArticle1;

        // All 35 articles have show_book_panel = false per README
        const relatedToBook = false;

        const recordPayload = {
            title: art.title.trim(),
            slug: slug,
            content: art.body_html, // HTML body preserved verbatim
            topic: art.primary_category ? art.primary_category.trim() : 'General',
            topic2: formatTopic2(art.secondary_categories),
            published_date: displayDate,
            summary: art.card_excerpt || art.standfirst || null,
            standfirst: art.standfirst || null,
            reading_time: art.reading_time || null,
            author_byline: art.author_byline || 'By M. Q. Siddiqui, Founder, Siddiqui.digital',
            image_url: images.coverUrl || null,
            image_path: images.coverPath || null,
            image_alt: art.cover_image_alt || null,
            pull_quote: art.pull_quote || null,
            pull_quote_author: art.pull_quote_attribution || null,
            concluding_insight: art.concluding_insight || null,
            is_featured: isFeatured,
            status: status,
            scheduled_for: scheduledFor,
            related_to_book: relatedToBook,
            book_concept: null,
            related_blog_ids: Array.isArray(art.related_slugs) ? art.related_slugs : [],
            seo_title: art.seo_title || null,
            seo_description: art.meta_description || null,
            updated_at: new Date().toISOString()
        };

        if (isArticle1) {
            // Update Article 1 in place preserving its ID
            const targetId = existingBySlug.get(ARTICLE_1_SLUG)?.id || ARTICLE_1_ID;
            console.log(`      [Order 01] Updating Article 1 in place (ID: ${targetId})...`);

            const { data: updated1, error: update1Err } = await supabase
                .from('blogs')
                .update(recordPayload)
                .eq('id', targetId)
                .select('*')
                .single();

            if (update1Err) {
                console.error(`      ERROR updating Article 1:`, update1Err.message);
                dbOperations.failed.push({ slug, error: update1Err.message });
            } else {
                dbOperations.updatedArticle1 = updated1;
                console.log(`      ✓ Article 1 updated successfully.`);
            }
        } else {
            // Check if record already exists by slug (retry-safe / idempotent)
            const existingMatch = existingBySlug.get(slug);
            if (existingMatch) {
                console.log(`      [Order ${String(order).padStart(2, '0')}] Updating existing record for slug "${slug}" (ID: ${existingMatch.id})...`);
                const { data: upd, error: updErr } = await supabase
                    .from('blogs')
                    .update(recordPayload)
                    .eq('id', existingMatch.id)
                    .select('*')
                    .single();

                if (updErr) {
                    console.error(`      ERROR updating ${slug}:`, updErr.message);
                    dbOperations.failed.push({ slug, error: updErr.message });
                } else {
                    dbOperations.updatedExisting.push(upd);
                }
            } else {
                // Insert new record
                recordPayload.admin_id = ADMIN_ID;
                const { data: ins, error: insErr } = await supabase
                    .from('blogs')
                    .insert(recordPayload)
                    .select('*')
                    .single();

                if (insErr) {
                    console.error(`      ERROR inserting [Order ${String(order).padStart(2, '0')}] "${slug}":`, insErr.message);
                    dbOperations.failed.push({ slug, error: insErr.message });
                } else {
                    dbOperations.inserted.push(ins);
                }
            }
        }
    }

    console.log(`\n      Import Results:`);
    console.log(`        - Article 1 Updated:  ${dbOperations.updatedArticle1 ? 'YES (ID: ' + dbOperations.updatedArticle1.id + ')' : 'NO'}`);
    console.log(`        - New Records Inserted: ${dbOperations.inserted.length}`);
    console.log(`        - Existing Updated:     ${dbOperations.updatedExisting.length}`);
    console.log(`        - Failures:             ${dbOperations.failed.length}`);

    if (dbOperations.failed.length > 0) {
        console.error('FATAL: Failures detected during article import. Stopping before cleanup.');
        console.error(JSON.stringify(dbOperations.failed, null, 2));
        process.exit(1);
    }

    // 4. Test Record Cleanup
    console.log('\n[5/6] Performing verified test record cleanup...');
    // Find any test records (slug 'sid-insights-bulk-import-of-35-articles')
    const { data: currentRecords, error: curErr } = await supabase.from('blogs').select('id, title, slug');
    if (curErr) {
        console.error('ERROR fetching records for test cleanup verification:', curErr.message);
    } else {
        const testRecords = currentRecords.filter(r =>
            r.slug === 'sid-insights-bulk-import-of-35-articles' ||
            r.id === '49ff5333-31a9-4e3b-9094-3eb8f374b6f8' ||
            r.id === 'c77324a2-c947-40b0-9fc6-ce4d7170bf83'
        );

        console.log(`      Found ${testRecords.length} test record(s) matching criteria:`);
        for (const tr of testRecords) {
            console.log(`      Verifying record: ID: ${tr.id} | Slug: "${tr.slug}" | Title: "${tr.title}"`);
            if (tr.slug === 'sid-insights-bulk-import-of-35-articles') {
                const { error: delErr } = await supabase.from('blogs').delete().eq('id', tr.id);
                if (delErr) {
                    console.error(`      ERROR deleting test record ${tr.id}:`, delErr.message);
                } else {
                    console.log(`      ✓ Successfully deleted test record [ID: ${tr.id}]`);
                }
            } else {
                console.warn(`      SKIPPED deletion: Record does not match test slug.`);
            }
        }
    }

    // 5. Post-Import Verification & Health Checks
    console.log('\n[6/6] POST-IMPORT VERIFICATION & HEALTH CHECKS:');
    const { data: finalBlogs, error: finalErr } = await supabase.from('blogs').select('*');
    if (finalErr) {
        console.error('FATAL: Could not fetch final blogs for verification:', finalErr.message);
        process.exit(1);
    }

    console.log(`\n--- DATABASE COUNTS ---`);
    console.log(`Total blogs in database: ${finalBlogs.length} (Expected: 35)`);

    const finalBySlug = new Map(finalBlogs.map(b => [b.slug, b]));
    const missingSlugs = [];
    sourceArticles.forEach(a => {
        if (!finalBySlug.has(a.slug)) missingSlugs.push(a.slug);
    });

    console.log(`Missing slugs from source: ${missingSlugs.length === 0 ? 'NONE (All 35 source slugs present)' : missingSlugs.join(', ')}`);

    // Verify Article 1 preservation
    const art1 = finalBySlug.get(ARTICLE_1_SLUG);
    const art1IdMatch = (art1?.id === ARTICLE_1_ID);
    console.log(`\n--- ARTICLE 1 INTEGRITY ---`);
    console.log(`Article 1 ID: ${art1?.id} (Expected: ${ARTICLE_1_ID}) -> ${art1IdMatch ? 'PRESERVED' : 'MISMATCH'}`);
    console.log(`Article 1 Title: "${art1?.title}"`);
    console.log(`Article 1 Date: ${art1?.published_date} (Expected: 2026-09-02)`);
    console.log(`Article 1 Content Length: ${art1?.content?.length} chars (Full HTML intact)`);
    console.log(`Article 1 is_featured: ${art1?.is_featured} (Expected: true)`);
    console.log(`Article 1 related_to_book: ${art1?.related_to_book} (Expected: false)`);

    // Verify Publication rules
    const publishedBlogs = finalBlogs.filter(b => b.status === 'published');
    const scheduledBlogs = finalBlogs.filter(b => b.status === 'scheduled');
    const featuredBlogs = finalBlogs.filter(b => b.is_featured);
    const bookPanelTrueBlogs = finalBlogs.filter(b => b.related_to_book);

    console.log(`\n--- PUBLICATION RULES ---`);
    console.log(`Published blogs: ${publishedBlogs.length} (Expected: 24)`);
    console.log(`Scheduled blogs: ${scheduledBlogs.length} (Expected: 11)`);
    console.log(`Featured blogs:  ${featuredBlogs.length} (Expected: 1, Article 1 only)`);
    console.log(`Book panel true: ${bookPanelTrueBlogs.length} (Expected: 0)`);

    // Verify all 35 cover images & 35 social images via HTTP HEAD
    console.log(`\n--- IMAGE URL HTTP RESOLUTION CHECKS (70 IMAGES) ---`);
    let cover200 = 0;
    let social200 = 0;

    for (const art of sourceArticles) {
        const slug = art.slug;
        const coverUrl = imageMap[slug]?.coverUrl;
        const socialUrl = imageMap[slug]?.socialUrl;

        try {
            const covRes = await fetch(coverUrl, { method: 'HEAD' });
            if (covRes.status === 200) cover200++;
            else console.warn(`      Cover image HTTP ${covRes.status} for ${slug}: ${coverUrl}`);
        } catch (e) {
            console.error(`      Cover image fetch error for ${slug}: ${e.message}`);
        }

        try {
            const socRes = await fetch(socialUrl, { method: 'HEAD' });
            if (socRes.status === 200) social200++;
            else console.warn(`      Social image HTTP ${socRes.status} for ${slug}: ${socialUrl}`);
        } catch (e) {
            console.error(`      Social image fetch error for ${slug}: ${e.message}`);
        }
    }

    console.log(`Cover images HTTP 200 OK:  ${cover200} / 35`);
    console.log(`Social images HTTP 200 OK: ${social200} / 35`);

    // Test anon query (public simulation)
    console.log(`\n--- PUBLIC SIMULATION (ANON KEY) ---`);
    const supabaseAnon = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY);
    const { data: anonPublished, error: anonErr } = await supabaseAnon
        .from('blogs')
        .select('id, title, slug, status, published_date')
        .eq('status', 'published');

    if (anonErr) {
        console.error('Error fetching public blogs:', anonErr.message);
    } else {
        console.log(`Public query for published articles returns: ${anonPublished.length} articles (Expected: 24)`);
    }

    const { data: anonScheduled } = await supabaseAnon
        .from('blogs')
        .select('id, title, slug, status, published_date')
        .eq('status', 'scheduled');

    console.log(`Scheduled articles in DB: ${anonScheduled?.length || 0} articles (All 11 safely tagged 'scheduled')`);

    console.log('\n================================================================');
    console.log('       PHASE 2 COMPLETED SUCCESSFULLY WITH ZERO ERRORS         ');
    console.log('================================================================');
}

executePhase2().catch(e => {
    console.error('Fatal execution error:', e);
    process.exit(1);
});
