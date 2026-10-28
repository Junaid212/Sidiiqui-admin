require('dotenv').config({ path: 'd:/Bright Media WORK/siddique-admin/server/.env' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('--- SUPABASE ENVIRONMENT & BUCKET INSPECTION ---');
    console.log('Target Supabase URL:', supabaseUrl);

    // 1. List storage buckets
    const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
    if (bErr) {
        console.error('Error fetching buckets:', bErr.message);
    } else {
        console.log('Existing Storage Buckets:');
        buckets.forEach(b => console.log(`  - Bucket: "${b.name}" (public: ${b.public}, id: ${b.id})`));
    }

    // 2. Fetch all current blogs
    const { data: blogs, error: blErr } = await supabase.from('blogs').select('*');
    if (blErr) {
        console.error('Error fetching blogs:', blErr.message);
        process.exit(1);
    }

    console.log(`\nCurrent blogs count: ${blogs.length}`);
    if (blogs.length > 0) {
        console.log('Available columns in blogs table:');
        console.log(Object.keys(blogs[0]).join(', '));
    }

    // 3. Create recoverable backup of affected blog records
    const backupDir = 'd:/Bright Media WORK/siddique-admin/server/backups';
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `blogs_backup_${timestamp}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(blogs, null, 2), 'utf-8');
    console.log(`\n[BACKUP CREATED] Successfully saved recoverable backup to: ${backupPath}`);
    console.log(`Backup records count: ${blogs.length}`);
    blogs.forEach(b => console.log(`  - ID: ${b.id} | Slug: ${b.slug} | Title: "${b.title}"`));
}

run().catch(console.error);
