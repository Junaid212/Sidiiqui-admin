require('dotenv').config({ path: 'd:/Bright Media WORK/siddique-admin/server/.env' });
const { createClient } = require('@supabase/supabase-js');

// Test with ANON key (same key used by public website)
const supabaseAnon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkAnonQueries() {
    console.log('Testing public query with ANON key:');
    
    // 1. All blogs with anon key
    const { data: allBlogs, error: allErr } = await supabaseAnon.from('blogs').select('id, title, status, published_date');
    if (allErr) {
        console.error('Anon error:', allErr.message);
    } else {
        console.log(`Anon key sees ${allBlogs.length} blogs:`);
        allBlogs.forEach(b => console.log(`  - [${b.status}] "${b.title}"`));
    }
}
checkAnonQueries();
