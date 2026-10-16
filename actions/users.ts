'use server';

import { getAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/lib/auth/guards';

export async function getAllUsersWithRestaurants() {
    try {
        await requireSuperAdmin();
        const admin = getAdminClient();

        // 1. Fetch email addresses from auth.users (requires service role)
        const { data: { users }, error: authError } = await admin.auth.admin.listUsers();

        if (authError) {
            console.error('Error fetching auth users:', authError);
            return { data: null, error: authError };
        }

        // 2. Fetch profiles and restaurant names
        const { data: profiles, error: profileError } = await admin
            .from('profiles')
            .select(`
                *,
                restaurants (
                    name
                )
            `);

        if (profileError) {
            console.error('Error fetching profiles:', profileError);
            return { data: null, error: profileError };
        }

        // 3. Map auth.users to profiles with metadata fallback
        const profilesData = (profiles || []) as any[];
        const mappedUsers = users.map((authUser: any) => {
            const profile = profilesData.find(p => p.id === authUser.id);
            
            const role = profile?.role || authUser.user_metadata?.role || 'user';
            const isPending = authUser.invited_at && !authUser.email_confirmed_at;
            const fullName = profile?.full_name || authUser.user_metadata?.full_name || (isPending ? 'Invitación Pendiente' : 'N/A');
            const restaurantName = profile?.restaurants?.name || 
                                   (authUser.user_metadata?.restaurant_id 
                                       ? (profilesData.find(p => p.restaurant_id === authUser.user_metadata.restaurant_id)?.restaurants?.name || 'Restaurante Vinculado') 
                                       : 'Super Admin / Sin Asignar');

            return {
                id: authUser.id,
                full_name: fullName,
                role: role,
                created_at: authUser.created_at || profile?.created_at || new Date().toISOString(),
                email: authUser.email || 'N/A',
                restaurant_name: restaurantName,
                is_pending: isPending
            };
        });

        // Sort by created_at descending
        mappedUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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

export async function deleteUserAction(userId: string) {
    try {
        const adminProfile = await requireSuperAdmin();

        // Validate inputs
        if (!userId || !userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            return { success: false, error: 'ID de usuario inválido' };
        }

        if (adminProfile.id === userId) {
            return { success: false, error: 'Por seguridad, no puedes eliminar tu propia cuenta de Super Administrador.' };
        }

        const admin = getAdminClient();

        // Delete user from Supabase Auth (cascades to public.profiles)
        const { error } = await admin.auth.admin.deleteUser(userId);

        if (error) {
            console.error('Error deleting user:', error);
            return { success: false, error: error.message };
        }

        revalidatePath('/[locale]/(super-admin)/super-admin/users', 'page');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || 'Unauthorized' };
    }
}
