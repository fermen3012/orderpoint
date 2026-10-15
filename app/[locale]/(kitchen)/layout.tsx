'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from '@/i18n/routing';
import { AlertTriangle } from 'lucide-react';

import { AuthProvider } from '@/components/auth/AuthContext';

export default function KitchenLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isSuspended, setIsSuspended] = useState(false);
    const [restaurantName, setRestaurantName] = useState('');
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

            if (profileData.role !== 'kitchen' && profileData.role !== 'admin' && !profileData.is_super_admin) {
                router.push('/login');
                return;
            }

            if (profileData.restaurant_id) {
                const { data: rest } = await (supabase
                    .from('restaurants' as any) as any)
                    .select('name, is_active')
                    .eq('id', profileData.restaurant_id)
                    .single();

                if (rest && rest.is_active === false && !profileData.is_super_admin) {
                    setIsSuspended(true);
                    setRestaurantName(rest.name || 'OrderPoint KDS');
                    setLoading(false);
                    return;
                }
            }

            setAuthData({
                userProfile: profileData,
                restaurantId: profileData.restaurant_id
            });
            setLoading(false);
        };
        checkAuth();
    }, [router, supabase]);

    if (loading) return null;

    if (isSuspended) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center select-none font-sans text-white">
                <div className="w-24 h-24 bg-rose-500/10 border-2 border-rose-500/30 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-2xl animate-pulse">
                    <AlertTriangle className="w-12 h-12 text-rose-500" />
                </div>
                <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500">
                        Cocina Suspendida
                    </span>
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-white italic tracking-tighter uppercase mb-4 max-w-lg">
                    Pantalla de Cocina Inactiva
                </h1>
                <p className="text-slate-400 text-sm md:text-base font-medium leading-relaxed max-w-md mb-8">
                    El servicio de cocina y KDS para este restaurante ha sido temporalmente suspendido por administración.
                </p>
                <div className="px-6 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {restaurantName}
                </div>
            </div>
        );
    }

    if (!authData) return null;

    return (
        <AuthProvider value={authData}>
            <div className="min-h-screen bg-slate-900">
                {children}
            </div>
        </AuthProvider>
    );
}
