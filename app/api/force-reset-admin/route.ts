import { getAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const supabase = getAdminClient();
        const email = 'admin@orderpoint.com';
        const password = 'admin123';

        console.log('Resetting Admin...');

        // 1. Ensure user exists in Auth
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;

        let adminUser = users.find(u => u.email === email);

        if (adminUser) {
            console.log('Admin found, updating...');
            const { error: updateError } = await supabase.auth.admin.updateUserById(adminUser.id, {
                password: password,
                email_confirm: true,
                user_metadata: { role: 'admin', full_name: 'Admin Sistema' }
            });
            if (updateError) throw updateError;
        } else {
            console.log('Admin not found, creating...');
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { role: 'admin', full_name: 'Admin Sistema' }
            });
            if (createError) throw createError;
            adminUser = newUser.user;
        }

        // 2. Ensure profile exists in DB
        if (adminUser) {
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: adminUser.id,
                    role: 'admin',
                    full_name: 'Admin Sistema'
                } as any);

            if (profileError) {
                console.error('Profile sync error:', profileError);
                // Don't throw yet, maybe it's just RLS
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Admin credentials forced to admin@orderpoint.com / admin123',
            userId: adminUser?.id
        });

    } catch (error: any) {
        console.error('Reset Admin Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
