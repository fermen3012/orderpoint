import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Short-lived in-memory caches to avoid redundant Auth + Profile roundtrips on every navigation
const AUTH_CACHE_TTL_MS = 30 * 1000;
const PROFILE_CACHE_TTL_MS = 60 * 1000;
const verifiedTokenCache = new Map<string, { user: any; expiresAt: number }>();
const profileRoleCache = new Map<string, { role: string | null; is_super_admin: boolean; expiresAt: number }>();

export async function updateSession(request: NextRequest, response: NextResponse) {
    // Ensure we have the environment variables before proceeding
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.error('Middleware: Missing Supabase Environment Variables');
        return response;
    }

    let supabaseResponse = response;

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    supabaseResponse.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                },
                remove(name: string, options: CookieOptions) {
                    supabaseResponse.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                },
            },
        }
    )

    let user = null;
    let accessToken: string | null = null;
    const now = Date.now();

    try {
        const { data: { session } } = await supabase.auth.getSession();
        accessToken = session?.access_token || null;

        if (accessToken) {
            const cachedUser = verifiedTokenCache.get(accessToken);
            if (cachedUser && cachedUser.expiresAt > now) {
                user = cachedUser.user;
            }
        }
    } catch {
        // Proceed to getUser
    }

    if (!user) {
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
        } catch (authErr) {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    user = session.user;
                }
            } catch (sessErr) {
                console.error('Middleware: getUser and getSession failed:', sessErr);
            }
        }
    }

    try {
        const pathname = request.nextUrl.pathname

        // Protected route check
        const isSuperAdminRoute = pathname.includes('/super-admin')
        const isKitchenRoute = pathname.includes('/kitchen')
        const isKioskRoute = pathname.includes('/kiosk')
        const isAdminRoute = pathname.match(/\/(es|en)\/admin/)
        const isExoRoute = pathname.includes('/exo')

        if (isSuperAdminRoute || isKitchenRoute || isKioskRoute || isAdminRoute || isExoRoute) {
            const localeMatch = pathname.match(/^\/(es|en)/);
            const locale = (localeMatch ? localeMatch[0] : '/es').replace(/^\//, '');

            const createRedirect = (path: string) => {
                const redirectResponse = NextResponse.redirect(new URL(path, request.url));
                // Copy cookies from our current supabaseResponse to the redirect response
                supabaseResponse.cookies.getAll().forEach(cookie => {
                    redirectResponse.cookies.set(cookie.name, cookie.value, {
                        ...cookie,
                    } as any);
                });
                return redirectResponse;
            };

            if (!user) {
                return createRedirect(`/${locale}/login`);
            }

            const now = Date.now();
            const cachedProfile = profileRoleCache.get(user.id);
            let isSuperAdmin = Boolean(user.app_metadata?.is_super_admin);
            let userRole: string | null = (user.app_metadata?.role as string) || null;

            if (cachedProfile && cachedProfile.expiresAt > now) {
                isSuperAdmin = Boolean(cachedProfile.is_super_admin || isSuperAdmin);
                userRole = cachedProfile.role || userRole;
            } else if (!userRole && !isSuperAdmin) {
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('role, is_super_admin')
                    .eq('id', user.id)
                    .single()

                isSuperAdmin = Boolean(profile?.is_super_admin || user.app_metadata?.is_super_admin);
                userRole = profile?.role || null;

                if (error || !profile) {
                    if (isSuperAdmin || userRole) {
                        console.log('Middleware: Profile query failed/empty, but user allowed via token override:', { isSuperAdmin, userRole });
                    } else {
                        console.error('Middleware: Profile query failed. Redirecting to login:', error);
                        return createRedirect(`/${locale}/login`);
                    }
                } else {
                    profileRoleCache.set(user.id, {
                        role: userRole,
                        is_super_admin: isSuperAdmin,
                        expiresAt: now + PROFILE_CACHE_TTL_MS
                    });
                }
            }

            // Authorization logic
            if (isSuperAdminRoute && !isSuperAdmin) {
                return createRedirect(`/${locale}/login`);
            }

            if (isKitchenRoute && userRole !== 'kitchen' && userRole !== 'admin') {
                return createRedirect(`/${locale}/login`);
            }

            if (isKioskRoute && userRole !== 'kiosk' && userRole !== 'admin') {
                return createRedirect(`/${locale}/login`);
            }

            if (isAdminRoute && userRole !== 'admin' && userRole !== 'owner') {
                return createRedirect(`/${locale}/login`);
            }

            if (isExoRoute && userRole !== 'mesera' && userRole !== 'admin' && userRole !== 'owner' && !isSuperAdmin) {
                return createRedirect(`/${locale}/login`);
            }
        }
    } catch (e) {
        console.error('Middleware Auth Error:', e)
        const pathname = request.nextUrl.pathname
        const isProtected = pathname.includes('/super-admin') || pathname.includes('/kitchen') || pathname.includes('/kiosk') || pathname.match(/\/(es|en)\/admin/) || pathname.includes('/exo')
        if (isProtected) {
            const localeMatch = pathname.match(/^\/(es|en)/);
            const locale = (localeMatch ? localeMatch[0] : '/es').replace(/^\//, '');
            return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
        }
    }

    return supabaseResponse
}
