'use server';

import { getAdminClient, createClient } from '../supabase/server';
import { revalidatePath } from 'next/cache';

async function checkAdminAuth() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    const { data: profile } = await (supabase
        .from('profiles' as any) as any)
        .select('*')
        .eq('id', user.id)
        .single();

    const profileData = profile as any;

    if (!profileData?.is_super_admin && profileData?.role !== 'admin' && profileData?.role !== 'owner') {
        throw new Error('Not authorized');
    }

    return { user, profile: profileData };
}

export async function getStaffUsers() {
    const { profile } = await checkAdminAuth();
    const supabase = getAdminClient();

    // 1. Get profiles from public table
    let query = (supabase
        .from('profiles' as any) as any)
        .select(`
            *,
            restaurant:restaurants(name)
        `)
        .order('created_at', { ascending: false });

    // Filter by restaurant if not super admin
    if (!profile.is_super_admin && profile.restaurant_id) {
        query = query.eq('restaurant_id', profile.restaurant_id);
    }

    const { data: profiles, error: profilesError } = await query;

    if (profilesError) {
        console.error('Error fetching staff profiles:', profilesError);
        return [];
    }

    const profilesData = profiles as any[];

    // 2. Get auth users to retrieve emails (requires service role key)
    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
        console.error('Error fetching auth users:', authError);
        return profilesData; // Fallback to profiles without emails if auth list fails
    }

    // 3. Merge profile data with auth emails and include pending invitations
    const allUsersMap = new Map();
    
    // Add existing database profiles
    profilesData.forEach(profile => {
        const authUser = authUsers?.find(u => u.id === profile.id);
        allUsersMap.set(profile.id, {
            ...profile,
            email: authUser?.email || '—',
            is_pending: authUser?.invited_at && !authUser?.email_confirmed_at
        });
    });

    // Add auth users who are pending invitation and don't have a profile yet
    authUsers?.forEach((authUser: any) => {
        const isPending = authUser.invited_at && !authUser.email_confirmed_at;
        if (isPending) {
            const userRestId = authUser.user_metadata?.restaurant_id;
            const matchesRestaurant = userRestId === profile.restaurant_id || profile.is_super_admin;
            
            if (matchesRestaurant && !allUsersMap.has(authUser.id)) {
                allUsersMap.set(authUser.id, {
                    id: authUser.id,
                    full_name: authUser.user_metadata?.full_name || 'Invitación Pendiente',
                    email: authUser.email || '—',
                    role: authUser.user_metadata?.role || 'kitchen',
                    restaurant_id: userRestId,
                    created_at: authUser.created_at,
                    is_pending: true
                });
            }
        }
    });

    const mergedList = Array.from(allUsersMap.values());
    mergedList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return mergedList;
}

export async function createStaffUser(formData: FormData) {
    const { profile: currentProfile } = await checkAdminAuth();
    const supabase = getAdminClient();

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as string;
    const fullName = formData.get('fullName') as string;

    if (!email || !email.includes('@')) {
        return { error: 'Correo electrónico inválido' };
    }
    if (!password || password.length < 6) {
        return { error: 'La contraseña debe tener al menos 6 caracteres' };
    }

    // Use current owner's restaurantId if they are an owner
    let restaurantId = formData.get('restaurantId') as string;
    if (!currentProfile.is_super_admin) {
        restaurantId = currentProfile.restaurant_id;
        const allowedRoles = ['admin', 'kitchen', 'kiosk', 'mesera'];
        if (!allowedRoles.includes(role)) {
            return { error: 'Rol no permitido para este usuario' };
        }
    }

    if (!restaurantId || !restaurantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return { error: 'ID de restaurante inválido' };
    }

    // 1. Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
            role,
            full_name: fullName,
            restaurant_id: restaurantId
        }
    });

    if (authError) {
        return { error: authError.message };
    }

    // Note: The profiles table is automatically populated by a database trigger (on_auth_user_created)
    // using the metadata provided above.

    revalidatePath('/admin/users');
    return { success: true };
}

export async function deleteStaffUser(userId: string) {
    const { profile: currentProfile } = await checkAdminAuth();
    const supabase = getAdminClient();

    // Validate UUID format
    if (!userId || !userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return { error: 'ID de usuario inválido' };
    }

    // Prevent deleting oneself
    if (userId === currentProfile.id) {
        return { error: 'No puedes eliminar tu propia cuenta' };
    }

    // Multi-tenant IDOR check: verify target user belongs to the same restaurant
    if (!currentProfile.is_super_admin) {
        const { data: targetProfile, error: profileErr } = await (supabase
            .from('profiles' as any) as any)
            .select('restaurant_id, is_super_admin, role')
            .eq('id', userId)
            .single();

        if (profileErr || !targetProfile) {
            return { error: 'Usuario no encontrado' };
        }

        if (targetProfile.is_super_admin) {
            return { error: 'No autorizado para eliminar a un Super Administrador' };
        }

        if (targetProfile.restaurant_id !== currentProfile.restaurant_id) {
            return { error: 'No autorizado: El usuario pertenece a otro restaurante' };
        }
    }

    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
        return { error: error.message };
    }

    revalidatePath('/admin/users');
    return { success: true };
}

export async function updateStaffUser(userId: string, formData: FormData) {
    const { profile: currentProfile } = await checkAdminAuth();
    const supabase = getAdminClient();

    // Validate UUID format
    if (!userId || !userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return { error: 'ID de usuario inválido' };
    }

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as string;
    const fullName = formData.get('fullName') as string;

    // Use current owner's restaurantId if they are not super admin
    let restaurantId = formData.get('restaurantId') as string;
    if (!currentProfile.is_super_admin) {
        restaurantId = currentProfile.restaurant_id;

        const { data: targetProfile, error: profileErr } = await (supabase
            .from('profiles' as any) as any)
            .select('restaurant_id, is_super_admin, role')
            .eq('id', userId)
            .single();

        if (profileErr || !targetProfile) {
            return { error: 'Usuario no encontrado' };
        }

        if (targetProfile.is_super_admin) {
            return { error: 'No autorizado para modificar a un Super Administrador' };
        }

        if (targetProfile.restaurant_id !== currentProfile.restaurant_id) {
            return { error: 'No autorizado: El usuario pertenece a otro restaurante' };
        }

        const allowedRoles = ['admin', 'kitchen', 'kiosk', 'mesera'];
        if (!allowedRoles.includes(role)) {
            return { error: 'Rol no permitido para este usuario' };
        }
    }

    // 1. Update user in Supabase Auth
    const updateData: any = {
        email,
        user_metadata: {
            role,
            full_name: fullName,
            restaurant_id: restaurantId
        }
    };

    if (password && password.length > 0) {
        if (password.length < 6) {
            return { error: 'La contraseña debe tener al menos 6 caracteres' };
        }
        updateData.password = password;
    }

    const { error: authError } = await supabase.auth.admin.updateUserById(userId, updateData);

    if (authError) {
        return { error: authError.message };
    }

    // 2. Update profiles table
    const { error: profileError } = await (supabase
        .from('profiles' as any) as any)
        .update({
            full_name: fullName,
            role: role as any,
            restaurant_id: restaurantId || null
        })
        .eq('id', userId);

    if (profileError) {
        return { error: profileError.message };
    }

    revalidatePath('/admin/users');
    return { success: true };
}
