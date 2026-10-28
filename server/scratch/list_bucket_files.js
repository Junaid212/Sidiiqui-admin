require('dotenv').config({ path: 'd:/Bright Media WORK/siddique-admin/server/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function listFiles() {
    const { data, error } = await supabase.storage.from('blogs').list('blog-images', { limit: 100 });
    if (error) {
        console.error('List error:', error);
        return;
    }
    console.log(`Files in blog-images (count: ${data.length}):`);
    data.forEach(f => console.log('  -', f.name));
}
listFiles();
