require('dotenv').config({ path: 'd:/Bright Media WORK/siddique-admin/server/.env' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const distBlogDir = 'd:/Bright Media WORK/Siddiui.digital-main/Siddiui.digital-main/dist/blog';

async function verifyAllPrerendered() {
    console.log('=== AUDITING ALL 24 GENERATED PRERENDERED PAGES ===\n');

    // 1. Fetch all articles from DB
    const { data: dbArticles } = await supabase
        .from('blogs')
        .select('title, slug, status, published_date, seo_title, seo_description');

    const publishedArticles = dbArticles.filter(a => a.status === 'published');
    const scheduledArticles = dbArticles.filter(a => a.status === 'scheduled');

    console.log(`DB Published Count: ${publishedArticles.length} (Expected: 24)`);
    console.log(`DB Scheduled Count: ${scheduledArticles.length} (Expected: 11)\n`);

    // 2. Check scheduled articles are NOT in dist/blog
    let scheduledLeakCount = 0;
    scheduledArticles.forEach(sa => {
        const p = path.join(distBlogDir, sa.slug);
        if (fs.existsSync(p)) {
            console.error(`LEAK DETECTED: Scheduled article has prerendered folder: ${sa.slug}`);
            scheduledLeakCount++;
        }
    });

    console.log(`Scheduled Articles Excluded: ${scheduledLeakCount === 0 ? 'PASS (0 leaks)' : 'FAIL (' + scheduledLeakCount + ' leaked)'}`);

    // 3. Check each published article in dist/blog
    let passCount = 0;
    let failedChecks = [];

    for (const pa of publishedArticles) {
        const filePath = path.join(distBlogDir, pa.slug, 'index.html');
        if (!fs.existsSync(filePath)) {
            failedChecks.push({ slug: pa.slug, reason: 'File does not exist' });
            continue;
        }

        const html = fs.readFileSync(filePath, 'utf8');

        // Check tags
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
        const canonMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["'](.*?)["']/i);
        const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i);
        const ogImgMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i);
        const twImgMatch = html.match(/<meta\s+name=["']twitter:image["']\s+content=["'](.*?)["']/i);
        const dateMatch = html.match(/<meta\s+property=["']article:published_time["']\s+content=["'](.*?)["']/i);

        if (!titleMatch || !descMatch || !canonMatch || !ogTitleMatch || !ogImgMatch || !twImgMatch || !dateMatch) {
            failedChecks.push({ slug: pa.slug, reason: 'Missing meta tag' });
            continue;
        }

        // Verify root container and script
        if (!html.includes('<div id="root"></div>') || !html.includes('src="/assets/index-')) {
            failedChecks.push({ slug: pa.slug, reason: 'Root container or bundle script missing' });
            continue;
        }

        passCount++;
    }

    console.log(`Prerendered Article Integrity: ${passCount} / 24 PASSED (Failed: ${failedChecks.length})`);
    if (failedChecks.length > 0) {
        console.error(JSON.stringify(failedChecks, null, 2));
    }
}

verifyAllPrerendered();
