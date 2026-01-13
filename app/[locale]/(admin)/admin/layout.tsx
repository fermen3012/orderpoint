'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from '@/i18n/routing';
import { AuthProvider } from '@/components/auth/AuthContext';

export default function ProtectedAdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [authData, setAuthData] = useState<{ userProfile: any, restaurantId: string | null } | null>(null);
    const supabase = createClient();

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                router.push('/login');
                return;
            }

            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (error || !profile) {
                router.push('/login');
                return;
            }

            const profileData = profile as any;

            if (profileData.role !== 'admin' && profileData.role !== 'owner' && !profileData.is_super_admin) {
                router.push('/login');
                return;
            }

            setAuthData({
                userProfile: profileData,
                restaurantId: profileData.restaurant_id
            });
            setLoading(false);
        };
        checkAuth();
    }, [router, supabase]);

    if (loading || !authData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <AuthProvider value={authData}>
            {children}
        </AuthProvider>
    );
}
