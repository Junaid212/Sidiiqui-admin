require('dotenv').config({ path: 'd:/Bright Media WORK/siddique-admin/server/.env' });
const supabaseUrl = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testSql() {
    // Test Supabase SQL endpoint
    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/`, {
            headers: {
                apikey: key,
                Authorization: `Bearer ${key}`
            }
        });
        console.log('Rest status:', res.status);
    } catch (e) {
        console.log('Rest err:', e.message);
    }
}
testSql();
