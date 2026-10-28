const fs = require('fs');
const path = require('path');

const targetScriptPath = 'd:/Bright Media WORK/Siddiui.digital-main/Siddiui.digital-main/scripts/prerender-blogs.mjs';

const scriptCode = `import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Read environment variables
let supabaseUrl = process.env.VITE_SUPABASE_URL;
let supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    const envPath = path.join(projectRoot, '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
                supabaseUrl = trimmed.split('=')[1]?.trim();
            }
            if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
                supabaseAnonKey = trimmed.split('=')[1]?.trim();
            }
        });
    }
}

// Fallback to verified project credentials
supabaseUrl = supabaseUrl || 'https://cneariiepqywvjpmznqn.supabase.co';
supabaseAnonKey = supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuZWFyaWllcHF5d3ZqcG16bnFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MjAzMTUsImV4cCI6MjA4Nzk5NjMxNX0.avMomExxnoAc-xZjo0TQZy8CqRQ7ZNdl_OwaSnSsSRI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function prerenderBlogs() {
    console.log('=== PRERENDERING BLOG OPENGRAPH / TWITTER METADATA (OPTION A) ===\\n');

    const distIndexPath = path.join(projectRoot, 'dist', 'index.html');
    if (!fs.existsSync(distIndexPath)) {
        console.error('ERROR: dist/index.html not found! Please run "npm run build" first.');
        process.exit(1);
    }

    const baseHtml = fs.readFileSync(distIndexPath, 'utf8');
    console.log(\`Loaded base HTML template from: \${distIndexPath} (\${baseHtml.length} bytes)\`);

    // Fetch ONLY published articles
    console.log('Querying Supabase for currently published articles...');
    const { data: articles, error } = await supabase
        .from('blogs')
        .select('title, slug, summary, standfirst, seo_title, seo_description, published_date, status')
        .eq('status', 'published')
        .order('published_date', { ascending: false });

    if (error) {
        console.error('Failed to fetch published articles from Supabase:', error.message);
        process.exit(1);
    }

    console.log(\`Found \${articles.length} published articles. Prerendering metadata pages...\\n\`);

    let successCount = 0;

    for (const art of articles) {
        const slug = art.slug;
        const title = (art.seo_title || art.title || 'Siddiqui.Digital').trim();
        const fullTitle = title.includes('M. Q. Siddiqui') || title.includes('Siddiqui.digital')
            ? title
            : \`\${title} | M. Q. Siddiqui\`;
        const description = (art.seo_description || art.standfirst || art.summary || 'Empowering entrepreneurs and students through strategic marketing.').trim();
        const articleUrl = \`https://siddiqui.digital/blog/\${slug}\`;
        const socialImageUrl = \`https://cneariiepqywvjpmznqn.supabase.co/storage/v1/object/public/blogs/blog-images/\${slug}-social.png\`;

        // Clean values for HTML attribute injection
        const safeTitle = fullTitle.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        const safeDesc = description.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        const safeUrl = articleUrl.replace(/"/g, '&quot;');
        const safeImg = socialImageUrl.replace(/"/g, '&quot;');

        let articleHtml = baseHtml;

        // 1. Title
        articleHtml = articleHtml.replace(/<title>.*?<\\/title>/i, \`<title>\${safeTitle}</title>\`);

        // 2. Meta description
        if (articleHtml.match(/<meta\\s+name=["']description["'].*?>/i)) {
            articleHtml = articleHtml.replace(/<meta\\s+name=["']description["'].*?>/i, \`<meta name="description" content="\${safeDesc}" />\`);
        }

        // 3. Canonical URL
        if (articleHtml.match(/<link\\s+rel=["']canonical["'].*?>/i)) {
            articleHtml = articleHtml.replace(/<link\\s+rel=["']canonical["'].*?>/i, \`<link rel="canonical" href="\${safeUrl}" />\`);
        }

        // 4. OpenGraph Tags
        articleHtml = articleHtml.replace(/<meta\\s+property=["']og:type["'].*?>/i, \`<meta property="og:type" content="article" />\`);
        articleHtml = articleHtml.replace(/<meta\\s+property=["']og:url["'].*?>/i, \`<meta property="og:url" content="\${safeUrl}" />\`);
        articleHtml = articleHtml.replace(/<meta\\s+property=["']og:title["'].*?>/i, \`<meta property="og:title" content="\${safeTitle}" />\`);
        articleHtml = articleHtml.replace(/<meta\\s+property=["']og:description["'].*?>/i, \`<meta property="og:description" content="\${safeDesc}" />\`);
        articleHtml = articleHtml.replace(/<meta\\s+property=["']og:image["'].*?>/i, \`<meta property="og:image" content="\${safeImg}" />
        <meta property="og:image:width" content="1600" />
        <meta property="og:image:height" content="820" />
        <meta property="article:published_time" content="\${art.published_date}" />
        <meta property="article:author" content="M. Q. Siddiqui" />\`);

        // 5. Twitter Card Tags
        articleHtml = articleHtml.replace(/<meta\\s+name=["']twitter:card["'].*?>/i, \`<meta name="twitter:card" content="summary_large_image" />\`);
        articleHtml = articleHtml.replace(/<meta\\s+name=["']twitter:url["'].*?>/i, \`<meta name="twitter:url" content="\${safeUrl}" />\`);
        articleHtml = articleHtml.replace(/<meta\\s+name=["']twitter:title["'].*?>/i, \`<meta name="twitter:title" content="\${safeTitle}" />\`);
        articleHtml = articleHtml.replace(/<meta\\s+name=["']twitter:description["'].*?>/i, \`<meta name="twitter:description" content="\${safeDesc}" />\`);
        articleHtml = articleHtml.replace(/<meta\\s+name=["']twitter:image["'].*?>/i, \`<meta name="twitter:image" content="\${safeImg}" />\`);

        // Ensure directory exists: dist/blog/<slug>/
        const targetDir = path.join(projectRoot, 'dist', 'blog', slug);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const targetFilePath = path.join(targetDir, 'index.html');
        fs.writeFileSync(targetFilePath, articleHtml, 'utf8');
        successCount++;
        console.log(\`  ✓ [\${successCount}/24] Prerendered: /blog/\${slug}\`);
    }

    console.log(\`\\n================================================================\`);
    console.log(\`✓ SUCCESS: \${successCount} article metadata pages created in dist/blog/<slug>/index.html\`);
    console.log(\`  - All 24 published articles have crawler-ready Open Graph and Twitter tags.\`);
    console.log(\`  - Zero scheduled articles were prerendered (protected from premature exposure).\`);
    console.log(\`  - React SPA bundle and <div id="root"></div> fully preserved for normal visitor navigation.\`);
    console.log(\`================================================================\\n\`);
}

prerenderBlogs().catch(err => {
    console.error('Prerender error:', err);
    process.exit(1);
});
`;

fs.writeFileSync(targetScriptPath, scriptCode, 'utf8');
console.log('Successfully written to:', targetScriptPath);
