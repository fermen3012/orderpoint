import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { type NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
    // 1. Handle session and super-admin protection
    const supabaseResponse = await updateSession(request);

    // If updateSession returned a redirect, return it immediately
    if (supabaseResponse.status === 307 || supabaseResponse.status === 308) {
        return supabaseResponse;
    }

    // 2. Handle internationalization
    return intlMiddleware(request);
}

export const config = {
    matcher: [
        '/',
        '/(es|en)/:path*',
        // Protect super-admin routes specifically if they are not caught by the above
        '/super-admin/:path*'
    ]
};
