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

    // 3. Merge profile data with auth emails
    return profilesData.map(profile => {
        const authUser = authUsers.find(u => u.id === profile.id);
        return {
            ...profile,
            email: authUser?.email || '—'
        };
    });
}

export async function createStaffUser(formData: FormData) {
    const { profile: currentProfile } = await checkAdminAuth();
    const supabase = getAdminClient();

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as string;
    const fullName = formData.get('fullName') as string;

    // Use current owner's restaurantId if they are an owner
    let restaurantId = formData.get('restaurantId') as string;
    if (!currentProfile.is_super_admin && currentProfile.restaurant_id) {
        restaurantId = currentProfile.restaurant_id;
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

    if (authUser.user) {
        const { error: profileError } = await (supabase.from('profiles' as any) as any).insert({
            id: authUser.user.id,
            full_name: fullName,
            role: role,
            restaurant_id: restaurantId || null
        });

        if (profileError) {
            console.error('Error creating profile:', profileError);
            // Rollback auth user
            await supabase.auth.admin.deleteUser(authUser.user.id);
            return { error: 'Error creating user profile: ' + profileError.message };
        }
    }

    revalidatePath('/admin/users');
    return { success: true };
}

export async function deleteStaffUser(userId: string) {
    await checkAdminAuth();
    const supabase = getAdminClient();

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

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as string;
    const fullName = formData.get('fullName') as string;

    // Use current owner's restaurantId if they are an owner
    let restaurantId = formData.get('restaurantId') as string;
    if (!currentProfile.is_super_admin && currentProfile.restaurant_id) {
        restaurantId = currentProfile.restaurant_id;
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
