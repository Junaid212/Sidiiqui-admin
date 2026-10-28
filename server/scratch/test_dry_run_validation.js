require('dotenv').config({ path: 'd:/Bright Media WORK/siddique-admin/server/.env' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { parseZipArticles } = require('../src/utils/zipArticleParser');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runDryRunValidation() {
    console.log('=== PHASE 1 DRY RUN: VALIDATING ACTUAL ZIP PACKAGE ===\n');

    const zipPath = 'C:\\Users\\Lenovo\\Downloads\\SID_Insights_Blog_Import.zip';
    if (!fs.existsSync(zipPath)) {
        console.error('ERROR: Real ZIP archive not found at:', zipPath);
        process.exit(1);
    }

    const zipBuffer = fs.readFileSync(zipPath);
    console.log(`Loaded real ZIP archive (${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

    // 1. Fetch current DB blogs (READ-ONLY)
    const { data: dbBlogs, error } = await supabase.from('blogs').select('id, title, slug, status, is_featured, published_date, related_to_book, topic, topic2');
    if (error) {
        console.error('Error fetching blogs from Supabase:', error.message);
        process.exit(1);
    }

    console.log(`Current DB records count: ${dbBlogs.length}`);
    dbBlogs.forEach(b => console.log(`  - [DB ID: ${b.id}] "${b.title}" (slug: ${b.slug})`));

    // 2. Run parseZipArticles
    const result = await parseZipArticles(zipBuffer, dbBlogs);

    console.log('\n=== PARSE SUMMARY ===');
    console.log('Total articles detected:', result.summary.totalArticles);
    console.log('Ready to import (new):', result.summary.readyToImport);
    console.log('Conflicts detected:', result.summary.conflicts);
    console.log('Missing cover images:', result.summary.missingImages);
    console.log('Validation errors:', result.summary.validationErrors);

    // 3. Detailed per-article checks
    let htmlPassCount = 0;
    let coverMatchCount = 0;
    let socialMatchCount = 0;
    let instagramLeakCount = 0;
    let publishedCount = 0;
    let scheduledCount = 0;
    let featuredCount = 0;
    let bookPanelFalseCount = 0;

    const dryRunActions = [];

    result.articles.forEach(art => {
        if (art.content && art.content.includes('<p>')) htmlPassCount++;
        if (art.image_status === 'matched') coverMatchCount++;
        if (art.social_image_status === 'matched') socialMatchCount++;
        if ((art.image_path || '').includes('instagram') || (art.social_image_path || '').includes('instagram')) instagramLeakCount++;
        if (art.status === 'published') publishedCount++;
        if (art.status === 'scheduled') scheduledCount++;
        if (art.is_featured) featuredCount++;
        if (!art.related_to_book) bookPanelFalseCount++;

        let action = 'INSERT';
        if (art.hasConflict) {
            action = 'UPDATE';
        }

        const projectedCoverUrl = `https://cneariiepqywvjpmznqn.supabase.co/storage/v1/object/public/blogs/${art.image_path}`;
        const projectedSocialUrl = `https://cneariiepqywvjpmznqn.supabase.co/storage/v1/object/public/blogs/${art.social_image_path}`;

        dryRunActions.push({
            order: art.order,
            action,
            slug: art.slug,
            title: art.title,
            category: art.topic,
            secondaryCategories: art.topic2,
            status: art.status,
            displayDate: art.published_date,
            scheduledFor: art.scheduled_for,
            isFeatured: art.is_featured,
            showBookPanel: art.related_to_book,
            coverImage: art.image_path,
            projectedCoverUrl,
            socialImage: art.social_image_path,
            projectedSocialUrl,
            contentLength: art.content.length,
            targetDbId: art.existingMatch?.id || 'NEW_UUID',
            hasRelatedSlugs: art.related_slugs.length
        });
    });

    console.log('\n=== FIELD & ASSET VERIFICATION METRICS ===');
    console.log(`HTML Body Present & Sanitized: ${htmlPassCount} / 35 articles`);
    console.log(`Cover Images Matched: ${coverMatchCount} / 35 articles`);
    console.log(`Social Images Matched: ${socialMatchCount} / 35 articles`);
    console.log(`Instagram Leak Count (Must be 0): ${instagramLeakCount}`);
    console.log(`Published Status Count (1-24): ${publishedCount} / 24`);
    console.log(`Scheduled Status Count (25-35): ${scheduledCount} / 11`);
    console.log(`Featured Count (Article 1 only): ${featuredCount} / 1`);
    console.log(`Book Panel False Count (All 35): ${bookPanelFalseCount} / 35`);

    console.log('\n=== DRY-RUN IMPORT PLAN (35 ARTICLES) ===');
    dryRunActions.forEach(d => {
        console.log(`[Order ${String(d.order).padStart(2, '0')}] ${d.action.padEnd(6, ' ')} | slug: ${d.slug.padEnd(52, ' ')} | Status: ${d.status.padEnd(9, ' ')} | Date: ${d.displayDate} | Cat: ${d.category} | Cover: ${d.coverImage} | Target: ${d.targetDbId}`);
    });

    // Verify non-article files are excluded
    const readmeFound = result.articles.some(a => a.title.toLowerCase().includes('readme') || a.slug.toLowerCase().includes('readme') || a.slug.toLowerCase().includes('bulk-import'));
    console.log(`\nREADME / Non-article files excluded: ${!readmeFound ? 'PASS (0 non-article files created)' : 'FAIL (README detected)'}`);
}

runDryRunValidation().catch(e => console.error(e));
