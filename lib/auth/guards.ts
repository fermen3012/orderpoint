import { createClient } from '../supabase/server';
import type { Database } from '../supabase/types';

export type UserProfile = Database['public']['Tables']['profiles']['Row'];

// Short-lived server memory caches to eliminate redundant Auth + Profile roundtrips across consecutive Server Actions
const AUTH_CACHE_TTL_MS = 30 * 1000;
const PROFILE_CACHE_TTL_MS = 60 * 1000;
const verifiedTokenCache = new Map<string, { user: any; expiresAt: number }>();
const profileCache = new Map<string, { profile: UserProfile; expiresAt: number }>();

/**
 * Ensures a user is authenticated and returns the user object.
 */
export async function requireUser() {
    const supabase = await createClient();
    let user = null;
    let accessToken: string | null = null;
    const now = Date.now();

    try {
        const { data: { session } } = await supabase.auth.getSession();
        accessToken = session?.access_token || null;

        if (accessToken) {
            const cached = verifiedTokenCache.get(accessToken);
            if (cached && cached.expiresAt > now) {
                return cached.user;
            }
        }
    } catch {
        // Proceed to getUser verification
    }

    try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
            user = userData.user;
            if (accessToken) {
                verifiedTokenCache.set(accessToken, { user, expiresAt: now + AUTH_CACHE_TTL_MS });
            }
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
    const now = Date.now();

    // Server-controlled claims and verified super admin email override only (never trust client-editable user_metadata)
    const isSuperAdminEmail = user.email === 'admin@orderpoint.com' && Boolean(user.email_confirmed_at);
    const isSuperAdminMetadata = user.app_metadata?.is_super_admin === true;

    // Fast-path for verified Super Admin (0ms, no DB roundtrip needed)
    if (isSuperAdminMetadata || isSuperAdminEmail) {
        const cachedSuper = profileCache.get(user.id);
        if (cachedSuper && cachedSuper.expiresAt > now) {
            return cachedSuper.profile;
        }
        const superProfile = {
            id: user.id,
            email: user.email || 'admin@orderpoint.com',
            role: 'admin',
            is_super_admin: true,
            restaurant_id: null,
            created_at: user.created_at || new Date().toISOString(),
            full_name: user.user_metadata?.full_name || 'Super Administrador',
            updated_at: new Date().toISOString(),
            phone: null,
            is_active: true
        } as any as UserProfile;
        profileCache.set(user.id, { profile: superProfile, expiresAt: now + PROFILE_CACHE_TTL_MS });
        return superProfile;
    }

    const cached = profileCache.get(user.id);
    if (cached && cached.expiresAt > now) {
        return cached.profile;
    }

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

    if (dbError || !profile) {
        throw new Error('Unauthorized: User profile not found');
    }

    profileCache.set(user.id, { profile, expiresAt: now + PROFILE_CACHE_TTL_MS });
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
