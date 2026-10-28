require('dotenv').config({ path: 'd:/Bright Media WORK/siddique-admin/server/.env' });
const supabaseUrl = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkBlogProps() {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const data = await res.json();
    console.log('blogs definition properties:');
    console.log(Object.keys(data.definitions?.blogs?.properties || {}));
}
checkBlogProps();
