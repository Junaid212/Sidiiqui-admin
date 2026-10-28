require('dotenv').config({ path: 'd:/Bright Media WORK/siddique-admin/server/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testRpc() {
    const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1;' });
    console.log('exec_sql result:', { data, error: error?.message });
}
testRpc();
