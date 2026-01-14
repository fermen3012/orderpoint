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

    try {
        const { data: { user } } = await supabase.auth.getUser()
        const pathname = request.nextUrl.pathname

        // Protected route check
        const isSuperAdminRoute = pathname.includes('/super-admin')
        const isKitchenRoute = pathname.includes('/kitchen')
        const isKioskRoute = pathname.includes('/kiosk')
        const isAdminRoute = pathname.match(/\/(es|en)\/admin/)

        if (isSuperAdminRoute || isKitchenRoute || isKioskRoute || isAdminRoute) {
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

            if (error || !profile) {
                return createRedirect(`/${locale}/login`);
            }

            // Authorization logic
            if (isSuperAdminRoute && !profile.is_super_admin) {
                return createRedirect(`/${locale}/login`);
            }

            if (isKitchenRoute && profile.role !== 'kitchen' && profile.role !== 'admin') {
                return createRedirect(`/${locale}/login`);
            }

            if (isKioskRoute && profile.role !== 'kiosk' && profile.role !== 'admin') {
                return createRedirect(`/${locale}/login`);
            }

            if (isAdminRoute && profile.role !== 'admin' && profile.role !== 'owner') {
                return createRedirect(`/${locale}/login`);
            }
        }
    } catch (e) {
        console.error('Middleware Auth Error:', e)
    }

    return supabaseResponse
}
