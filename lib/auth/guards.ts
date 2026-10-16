import { createClient } from '../supabase/server';
import type { Database } from '../supabase/types';

export type UserProfile = Database['public']['Tables']['profiles']['Row'];

/**
 * Ensures a user is authenticated and returns the user object.
 */
export async function requireUser() {
    const supabase = await createClient();
    let user = null;
    
    try {
        const { data: userData, error } = await supabase.auth.getUser();
        if (userData?.user) {
            user = userData.user;
        } else {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                user = session.user;
            }
        }
    } catch (err) {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                user = session.user;
            }
        } catch (sessErr) {
            console.error('requireUser: Fallback session failed:', sessErr);
        }
    }

    if (!user) {
        throw new Error('Unauthorized: Authentication required');
    }

    return user;
}

/**
 * Ensures the authenticated user has a profile in the database and returns it.
 */
export async function requireProfile(): Promise<UserProfile> {
    const user = await requireUser();
    const supabase = await createClient();

    let profile: UserProfile | null = null;
    let dbError = null;

    try {
        const { data: dbProfile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        profile = dbProfile as any;
        dbError = error;
    } catch (err) {
        dbError = err;
    }

    // Server-controlled claims and verified super admin email override only (never trust client-editable user_metadata)
    const isSuperAdminEmail = user.email === 'admin@orderpoint.com' && Boolean(user.email_confirmed_at);
    const isSuperAdminMetadata = user.app_metadata?.is_super_admin === true;

    if (dbError || !profile) {
        if (isSuperAdminEmail || isSuperAdminMetadata) {
            console.log('requireProfile: Profile query failed/empty, using fallback token metadata profile override');
            return {
                id: user.id,
                email: user.email || 'admin@orderpoint.com',
                role: 'admin',
                is_super_admin: true,
                restaurant_id: null,
                created_at: new Date().toISOString(),
                full_name: 'Super Administrador',
                updated_at: new Date().toISOString(),
                phone: null,
                is_active: true
            } as any as UserProfile;
        }

        throw new Error('Unauthorized: User profile not found');
    }

    if (isSuperAdminEmail && !profile.is_super_admin) {
        profile.is_super_admin = true;
        profile.role = 'admin';
    }

    return profile;
}

/**
 * Ensures the authenticated user is a super administrator.
 */
export async function requireSuperAdmin(): Promise<UserProfile> {
    const profile = await requireProfile();

    if (!profile.is_super_admin) {
        throw new Error('Forbidden: Super Admin access required');
    }

    return profile;
}

/**
 * Ensures the authenticated user is a super admin or has one of the allowed roles for their restaurant.
 */
export async function requireRestaurantRole(
    allowedRoles: ('admin' | 'kitchen' | 'kiosk' | 'owner' | 'mesera')[]
): Promise<UserProfile> {
    const profile = await requireProfile();

    if (profile.is_super_admin) {
        return profile;
    }

    if (!allowedRoles.includes(profile.role)) {
        throw new Error(`Forbidden: Unauthorized role. Required one of: ${allowedRoles.join(', ')}`);
    }

    return profile;
}

/**
 * Ensures the authenticated user belongs to the specified restaurant, or is a super admin.
 */
export async function requireSameRestaurant(restaurantId: string): Promise<UserProfile> {
    const profile = await requireProfile();

    if (profile.is_super_admin) {
        return profile;
    }

    if (!profile.restaurant_id || profile.restaurant_id !== restaurantId) {
        throw new Error('Forbidden: You do not have access to this restaurant');
    }

    return profile;
}

/**
 * Retrieves the current user's restaurant ID. If the user is a super admin, returns null.
 * Otherwise, ensures they have a restaurant ID associated and returns it.
 */
export async function getCurrentRestaurantId(): Promise<string | null> {
    const profile = await requireProfile();

    if (profile.is_super_admin) {
        return null;
    }

    if (!profile.restaurant_id) {
        throw new Error('Forbidden: User is not associated with any restaurant');
    }

    return profile.restaurant_id;
}
