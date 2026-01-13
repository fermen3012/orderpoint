import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()
    const pathname = request.nextUrl.pathname

    // Protected route check
    const isSuperAdminRoute = pathname.includes('/super-admin')
    const isKitchenRoute = pathname.includes('/kitchen')
    const isKioskRoute = pathname.includes('/kiosk')
    const isAdminRoute = pathname.match(/\/(es|en)\/admin/) // Protects /admin but not /login or /set-password

    if (isSuperAdminRoute || isKitchenRoute || isKioskRoute || isAdminRoute) {
        const localeMatch = pathname.match(/^\/(es|en)/);
        const locale = localeMatch ? localeMatch[0] : '/es';

        if (!user) {
            return NextResponse.redirect(new URL(`${locale}/login`, request.url))
        }

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('role, is_super_admin')
            .eq('id', user.id)
            .single()

        if (error || !profile) {
            return NextResponse.redirect(new URL(`${locale}/login`, request.url))
        }

        // Super Admin has access to everything
        if (profile.is_super_admin) {
            return response
        }

        // Logic for specific routes
        if (isSuperAdminRoute && !profile.is_super_admin) {
            return NextResponse.redirect(new URL(`${locale}/login`, request.url))
        }

        if (isKitchenRoute && profile.role !== 'kitchen' && profile.role !== 'admin') {
            return NextResponse.redirect(new URL(`${locale}/login`, request.url))
        }

        if (isKioskRoute && profile.role !== 'kiosk' && profile.role !== 'admin') {
            return NextResponse.redirect(new URL(`${locale}/login`, request.url))
        }

        if (isAdminRoute && profile.role !== 'admin' && profile.role !== 'owner') {
            return NextResponse.redirect(new URL(`${locale}/login`, request.url))
        }
    }

    return response
}
