import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

let supabaseUrl = '';
let supabaseServiceKey = '';

try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        envContent.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx !== -1) {
                    const key = trimmed.slice(0, eqIdx).trim();
                    let val = trimmed.slice(eqIdx + 1).trim();
                    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                        val = val.slice(1, -1);
                    }
                    if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = val;
                    if (key === 'SUPABASE_SERVICE_ROLE_KEY') supabaseServiceKey = val;
                }
            }
        });
    }
} catch (e) {
    console.warn(e);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
    const testEmail = 'test_owner_check_link@example.com';
    const restaurantId = '0dabef13-28dc-42a1-9fa7-355eeab6b5d1';

    console.log('Testing generateLink...');
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email: testEmail,
        options: {
            data: {
                role: 'owner',
                restaurant_id: restaurantId
            },
            redirectTo: 'http://localhost:3000/set-password'
        }
    });

    if (linkErr) {
        console.error('generateLink error:', linkErr);
    } else {
        console.log('generateLink SUCCESS!');
        console.log('Action link:', linkData?.properties?.action_link);
        console.log('Hashed token:', linkData?.properties?.hashed_token);
        
        // Clean up test user
        if (linkData?.user?.id) {
            await supabaseAdmin.auth.admin.deleteUser(linkData.user.id);
            console.log('Cleaned up test user successfully');
        }
    }
}

main().catch(console.error);
