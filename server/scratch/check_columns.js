require('dotenv').config({ path: 'd:/Bright Media WORK/siddique-admin/server/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    // Check if social_image_url exists
    const { data, error } = await supabase.from('blogs').select('id, social_image_url, social_image_path').limit(1);
    if (error) {
        console.log('Query with social_image_url returned error:', error.message);
    } else {
        console.log('social_image_url column exists!');
    }
}
check();
