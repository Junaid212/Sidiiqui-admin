require('dotenv').config({ path: 'd:/Bright Media WORK/siddique-admin/server/.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testSocialInjection() {
    console.log('=== TESTING SOCIAL METADATA INJECTION FOR CRAWLERS ===\n');

    // 1. Fetch Article 1 & Article 2 from Supabase
    const { data: articles, error } = await supabase
        .from('blogs')
        .select('title, slug, summary, standfirst, seo_title, seo_description, published_date, status')
        .in('slug', ['marketing-is-not-failing-it-is-misplaced', 'why-marketing-gets-marginalized']);

    if (error) {
        console.error('Fetch error:', error);
        return;
    }

    articles.forEach(art => {
        const title = art.seo_title || art.title;
        const description = art.seo_description || art.standfirst || art.summary || 'Business Solutions';
        const socialImageUrl = `https://cneariiepqywvjpmznqn.supabase.co/storage/v1/object/public/blogs/blog-images/${art.slug}-social.png`;
        const articleUrl = `https://siddiqui.digital/blog/${art.slug}`;

        console.log(`[ARTICLE: ${art.slug}]`);
        console.log(`  Title:       ${title}`);
        console.log(`  Description: ${description}`);
        console.log(`  Social Image:${socialImageUrl}`);
        console.log(`  Status:      ${art.status}`);

        const metaTags = `
    <!-- Crawlers Meta Tags: Open Graph / Facebook / LinkedIn / WhatsApp -->
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${articleUrl}" />
    <meta property="og:title" content="${title.replace(/"/g, '&quot;')}" />
    <meta property="og:description" content="${description.replace(/"/g, '&quot;')}" />
    <meta property="og:image" content="${socialImageUrl}" />
    <meta property="og:image:width" content="1600" />
    <meta property="og:image:height" content="820" />
    <meta property="article:published_time" content="${art.published_date}" />
    <meta property="article:author" content="M. Q. Siddiqui" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${articleUrl}" />
    <meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}" />
    <meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}" />
    <meta name="twitter:image" content="${socialImageUrl}" />
`;
        console.log('  Generated Injected Head:');
        console.log(metaTags);
        console.log('--------------------------------------------------\n');
    });
}

testSocialInjection();
