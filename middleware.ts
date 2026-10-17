import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
    // Direct rewrite for /set-password (canonical invite callback) so it serves /es/set-password with 200 OK without dropping URL hashes
    if (request.nextUrl.pathname === '/set-password') {
        const rewriteUrl = request.nextUrl.clone();
        rewriteUrl.pathname = '/es/set-password';
        const response = NextResponse.rewrite(rewriteUrl);
        return await updateSession(request, response);
    }

    // 1. Handle internationalization first
    const response = intlMiddleware(request);

    // If it's a redirect or rewrite from next-intl, return it early
    if (response.status >= 300 && response.status < 400) {
        return response;
    }

    // 2. Update session using that response only if we stay on the same page
    return await updateSession(request, response);
}

export const config = {
    matcher: [
        '/',
        '/set-password',
        '/(es|en)/:path*',
        // Protect super-admin routes specifically if they are not caught by the above
        '/super-admin/:path*'
    ]
};
