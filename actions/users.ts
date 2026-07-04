'use server';

import { getAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/lib/auth/guards';

export async function getAllUsersWithRestaurants() {
    try {
        await requireSuperAdmin();
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
    } catch (e: any) {
        return { data: null, error: e.message || 'Unauthorized' };
    }
}

export async function resetUserPassword(userId: string, newPassword: string) {
    try {
        await requireSuperAdmin();

        // Validate inputs
        if (!userId || !userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            return { success: false, error: 'ID de usuario inválido' };
        }
        if (!newPassword || newPassword.length < 6) {
            return { success: false, error: 'La contraseña debe tener al menos 6 caracteres' };
        }

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
    } catch (e: any) {
        return { success: false, error: e.message || 'Unauthorized' };
    }
}
