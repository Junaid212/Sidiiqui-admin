require('dotenv').config({ path: 'd:/Bright Media WORK/siddique-admin/server/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectColumns() {
    // Try querying information_schema
    const { data, error } = await supabase
        .from('blogs')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns currently in blogs table:');
        console.log(Object.keys(data[0]));
    }
}
inspectColumns();
