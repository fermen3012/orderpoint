'use client';

import { useEffect } from 'react';
import { adminSupabase } from '@/lib/supabase/admin-client';
import { useRouter } from '@/i18n/routing';

export default function AdminPage() {
    const router = useRouter();

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await adminSupabase.auth.getSession();
            if (session) {
                router.replace('/admin/dashboard');
            } else {
                router.replace('/login');
            }
        };

        checkAuth();
    }, [router]);

    return null;
}
