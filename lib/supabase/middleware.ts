import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
    try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userData?.user) {
            user = userData.user;
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

            const { data: profile, error } = await supabase
                .from('profiles')
                .select('role, is_super_admin')
                .eq('id', user.id)
                .single()

            let isSuperAdmin = profile?.is_super_admin;
            let userRole = profile?.role;

            // Unconditional overrides based on secure session claims and email credentials
            if (user.email === 'admin@orderpoint.com') {
                isSuperAdmin = true;
                userRole = 'admin';
            }

            if (user.user_metadata?.is_super_admin === true || user.app_metadata?.is_super_admin === true) {
                isSuperAdmin = true;
            }

            if (error || !profile) {
                if (isSuperAdmin || userRole) {
                    console.log('Middleware: Profile query failed/empty, but user allowed via token override:', { isSuperAdmin, userRole });
                } else {
                    console.error('Middleware: Profile query failed. Redirecting to login:', error);
                    return createRedirect(`/${locale}/login`);
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
    }

    return supabaseResponse
}
