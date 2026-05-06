require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function testCreateUser() {
    console.log("Testing user creation...");
    const email = "test_admin_" + Date.now() + "@siddiqui.digital";
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: "TestPassword123!",
        email_confirm: true,
        user_metadata: { full_name: "Test Admin" }
    });

    if (error) {
        console.error("Error creating user:", error);
    } else {
        console.log("Success! User created:", data.user.id);
        
        console.log("Cleaning up user...");
        await supabaseAdmin.auth.admin.deleteUser(data.user.id);
    }
}

testCreateUser();
