import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { type NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
    // 1. Handle internationalization first to get the base response
    const response = intlMiddleware(request);

    // 2. Update session using that response
    return await updateSession(request, response);
}

export const config = {
    matcher: [
        '/',
        '/(es|en)/:path*',
        // Protect super-admin routes specifically if they are not caught by the above
        '/super-admin/:path*'
    ]
};
