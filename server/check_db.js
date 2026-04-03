require('dotenv').config({ path: 'd:/Bright Media WORK/siddique-admin/server/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    // Try to insert a dummy record with selected_date and selected_time to see if it fails
    const { data, error } = await supabase.from('consultations').insert([{
        name: 'Test',
        email: 'test@example.com',
        phone: '1234567890',
        selected_date: '2026-03-20',
        selected_time: '14:00',
        message: 'Test message',
        created_at: new Date().toISOString()
    }]).select();

    console.log('Insert with selected_*:');
    console.log('Data:', data);
    console.log('Error:', error);

    // Get one row to check the columns
    const { data: row, error: rowError } = await supabase.from('consultations').select('*').limit(1);
    console.log('\nRow structure:');
    console.log('Data:', row);
}

check();
