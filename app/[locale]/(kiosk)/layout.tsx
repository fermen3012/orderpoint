'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from '@/i18n/routing';
import { AlertTriangle } from 'lucide-react';

import { AuthProvider } from '@/components/auth/AuthContext';
import IdleTimer from '@/components/system/IdleTimer';

export default function KioskLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isSuspended, setIsSuspended] = useState(false);
    const [restaurantName, setRestaurantName] = useState('');
    const [authData, setAuthData] = useState<{ userProfile: any, restaurantId: string | null } | null>(null);
    const [supabase] = useState(() => createClient());

    useEffect(() => {
        let isMounted = true;
        const safetyTimeout = setTimeout(() => {
            if (isMounted) {
                setLoading(false);
                router.push('/login');
            }
        }, 8000);

        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    if (isMounted) router.push('/login');
                    return;
                }

                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();

                let profileData = profile as any;

                if (error || !profileData) {
                    const metaRole = session.user.user_metadata?.role || session.user.app_metadata?.role;
                    const metaSuper = Boolean(session.user.user_metadata?.is_super_admin || session.user.app_metadata?.is_super_admin);
                    const metaRestId = session.user.user_metadata?.restaurant_id || null;

                    if (metaRole || metaSuper) {
                        profileData = {
                            id: session.user.id,
                            email: session.user.email,
                            role: metaRole || 'kiosk',
                            is_super_admin: metaSuper,
                            restaurant_id: metaRestId
                        };
                    } else {
                        if (isMounted) router.push('/login');
                        return;
                    }
                }

                if (profileData.role !== 'kiosk' && profileData.role !== 'admin' && profileData.role !== 'owner' && !profileData.is_super_admin) {
                    if (isMounted) router.push('/login');
                    return;
                }

                // Verificar si el restaurante está activo
                if (profileData.restaurant_id) {
                    const { data: rest } = await (supabase
                        .from('restaurants' as any) as any)
                        .select('name, is_active')
                        .eq('id', profileData.restaurant_id)
                        .single();

                    if (rest && isMounted) {
                        setRestaurantName(rest.name || '');
                        if (rest.is_active === false && !profileData.is_super_admin) {
                            setIsSuspended(true);
                        }
                    }
                }

                if (isMounted) {
                    setAuthData({
                        userProfile: profileData,
                        restaurantId: profileData.restaurant_id
                    });
                    setLoading(false);
                }
            } catch (err) {
                console.error('KioskLayout: Error checking auth:', err);
                if (isMounted) router.push('/login');
            } finally {
                clearTimeout(safetyTimeout);
            }
        };
        checkAuth();

        return () => {
            isMounted = false;
            clearTimeout(safetyTimeout);
        };
    }, [router, supabase]);

    if (loading || !authData) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 gap-4">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (isSuspended) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center select-none font-sans">
                <div className="w-24 h-24 bg-rose-500/10 border-2 border-rose-500/30 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-2xl animate-pulse">
                    <AlertTriangle className="w-12 h-12 text-rose-500" />
                </div>
                <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500">
                        Terminal Suspendida
                    </span>
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-white italic tracking-tighter uppercase mb-4 max-w-lg">
                    Terminal Fuera de Servicio
                </h1>
                <p className="text-slate-400 text-sm md:text-base font-medium leading-relaxed max-w-md mb-8">
                    Esta estación de autoservicio se encuentra temporalmente inactiva por administración. Por favor acérquese al mostrador para ser atendido.
                </p>
                <div className="px-6 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {restaurantName || 'OrderPoint Kiosk'}
                </div>
            </div>
        );
    }

    return (
        <AuthProvider value={authData}>
            <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50">
                <IdleTimer />
                {children}
            </div>
        </AuthProvider>
    );
}
