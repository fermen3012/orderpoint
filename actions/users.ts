'use server';

import { getAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getAllUsersWithRestaurants() {
    const admin = getAdminClient();

    // 1. Fetch profiles and restaurant names
    const { data: profiles, error: profileError } = await admin
        .from('profiles')
        .select(`
            *,
            restaurants (
                name
            )
        `)
        .order('created_at', { ascending: false });

    if (profileError || !profiles) {
        console.error('Error fetching profiles:', profileError);
        return { data: null, error: profileError };
    }

    // 2. Fetch email addresses from auth.users (requires service role)
    const { data: { users }, error: authError } = await admin.auth.admin.listUsers();

    if (authError) {
        console.error('Error fetching auth users:', authError);
        return { data: null, error: authError };
    }

    // 3. Map email to profiles
    const mappedUsers = profiles.map((profile: any) => {
        const authUser = users.find(u => u.id === profile.id);
        return {
            id: profile.id,
            full_name: profile.full_name,
            role: profile.role,
            created_at: profile.created_at,
            email: authUser?.email || 'N/A',
            restaurant_name: profile.restaurants?.name || 'Super Admin / Sin Asignar'
        };
    });

    return { data: mappedUsers, error: null };
}

export async function resetUserPassword(userId: string, newPassword: string) {
    const admin = getAdminClient();

    const { error } = await admin.auth.admin.updateUserById(userId, {
        password: newPassword
    });

    if (error) {
        console.error('Error resetting password:', error);
        return { success: false, error: error.message };
    }

    revalidatePath('/[locale]/(super-admin)/super-admin/users', 'page');
    return { success: true };
}
