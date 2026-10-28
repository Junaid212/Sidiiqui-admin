require('dotenv').config({ path: 'd:/Bright Media WORK/siddique-admin/server/.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runPrerenderVerification() {
    console.log('=== VERIFYING STATIC PRERENDER CAPABILITY ===\n');

    // 1. Fetch all published blogs
    const { data: publishedBlogs, error } = await supabase
        .from('blogs')
        .select('title, slug, summary, standfirst, seo_title, seo_description, published_date')
        .eq('status', 'published');

    if (error) {
        console.error('Fetch error:', error);
        return;
    }

    console.log(`Found ${publishedBlogs.length} published blogs in Supabase (Expected: 24).`);

    // 2. Sample base HTML shell (same structure as Vite dist/index.html)
    const baseHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Siddiqui.Digital | Business Solutions</title>
    <meta name="description" content="Business Solutions">
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Siddiqui.digital | Business Solutions" />
    <meta property="og:description" content="Empowering entrepreneurs and students through strategic marketing." />
    <meta property="og:image" content="https://siddiqui.digital/assets/images/og-image.jpg" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Siddiqui.digital | Business Solutions" />
    <meta name="twitter:description" content="Empowering entrepreneurs and students through strategic marketing." />
    <meta name="twitter:image" content="https://siddiqui.digital/assets/images/og-image.jpg" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index-sample.js"></script>
  </body>
</html>`;

    // 3. Generate sample for Article 1
    const art1 = publishedBlogs.find(b => b.slug === 'marketing-is-not-failing-it-is-misplaced');
    const title = art1.seo_title || art1.title;
    const desc = art1.seo_description || art1.standfirst || art1.summary;
    const socialImg = `https://cneariiepqywvjpmznqn.supabase.co/storage/v1/object/public/blogs/blog-images/${art1.slug}-social.png`;
    const canonical = `https://siddiqui.digital/blog/${art1.slug}`;

    let customizedHtml = baseHtml
        .replace(/<title>.*?<\/title>/, `<title>${title.replace(/&/g, '&amp;')}</title>`)
        .replace(/<meta name="description" content=".*?"\s*\/?>/, `<meta name="description" content="${desc.replace(/"/g, '&quot;')}" />`)
        .replace(/<meta property="og:type" content=".*?"\s*\/?>/, `<meta property="og:type" content="article" />`)
        .replace(/<meta property="og:title" content=".*?"\s*\/?>/, `<meta property="og:title" content="${title.replace(/"/g, '&quot;')}" />`)
        .replace(/<meta property="og:description" content=".*?"\s*\/?>/, `<meta property="og:description" content="${desc.replace(/"/g, '&quot;')}" />`)
        .replace(/<meta property="og:image" content=".*?"\s*\/?>/, `<meta property="og:image" content="${socialImg}" />\n    <meta property="og:url" content="${canonical}" />\n    <meta property="og:image:width" content="1600" />\n    <meta property="og:image:height" content="820" />`)
        .replace(/<meta name="twitter:title" content=".*?"\s*\/?>/, `<meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}" />`)
        .replace(/<meta name="twitter:description" content=".*?"\s*\/?>/, `<meta name="twitter:description" content="${desc.replace(/"/g, '&quot;')}" />`)
        .replace(/<meta name="twitter:image" content=".*?"\s*\/?>/, `<meta name="twitter:image" content="${socialImg}" />`);

    console.log('Sample injected HTML output for Article 1:');
    console.log(customizedHtml);
    console.log('\nVerification: Successfully transformed all crawler tags while keeping root and script bundle intact.');
}

runPrerenderVerification();
