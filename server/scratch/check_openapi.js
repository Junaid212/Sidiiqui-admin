require('dotenv').config({ path: 'd:/Bright Media WORK/siddique-admin/server/.env' });
const supabaseUrl = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkOpenApi() {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const data = await res.json();
    console.log('Definitions:', Object.keys(data.definitions || {}));
    console.log('RPC paths:', Object.keys(data.paths || {}).filter(p => p.startsWith('/rpc')));
}
checkOpenApi();
