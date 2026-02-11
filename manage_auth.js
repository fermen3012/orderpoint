const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Robust .env loading
function loadEnv() {
    try {
        const envPath = path.join(__dirname, '.env.local');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            const lines = content.split(/\r?\n/);
            lines.forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    let value = match[2].trim();
                    // Remove quotes if present
                    if ((value.startsWith('"') && value.endsWith('"')) ||
                        (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }
                    process.env[key] = value;
                }
            });
        }
    } catch (e) {
        console.error('Error loading .env.local:', e);
    }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error('Error: Could not find NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    console.log('Current directory:', __dirname);
    process.exit(1);
}

const supabase = createClient(url, key, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (command === 'list') {
        const { data: { users }, error } = await supabase.auth.admin.listUsers();
        if (error) {
            console.error('Error listing users:', error.message);
            return;
        }
        console.log('\nRegistered Users:');
        console.log('-----------------');
        users.forEach(u => {
            console.log(`Email: ${u.email} | ID: ${u.id} | Last Sign In: ${u.last_sign_in_at || 'Never'}`);
        });
        console.log('-----------------\n');
    }
    else if (command === 'reset' && args[1] && args[2]) {
        const email = args[1];
        const newPassword = args[2];
        console.log(`Resetting password for ${email}...`);

        const { data: { users } } = await supabase.auth.admin.listUsers();
        const user = users.find(u => u.email === email);

        if (!user) {
            console.error('User not found!');
            return;
        }

        const { error } = await supabase.auth.admin.updateUserById(
            user.id,
            { password: newPassword }
        );

        if (error) {
            console.error('Error updating password:', error.message);
        } else {
            console.log('Success! Password updated.');
        }
    }
    else {
        console.log('Usage:');
        console.log('  node manage_auth.js list');
        console.log('  node manage_auth.js reset <email> <new_password>');
    }
}

main();
