'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import TableGrid from '@/components/exo/TableGrid';
import { Loader2, Search, LogOut } from 'lucide-react';
import { useRestaurantStore } from '@/store/restaurant-store';
import { useExoCartStore } from '@/store/exo-cart-store';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

function TablesPageContent() {
    const t = useTranslations('exo');
    const supabase = createClient();
    const router = useRouter();
    const searchParams = useSearchParams();
    const paramRestaurantId = searchParams?.get('restaurant_id');

    const { restaurantName, setRestaurant } = useRestaurantStore();
    const { setWaitressId, resetStore } = useExoCartStore();
    const [currentWaitress, setCurrentWaitress] = useState<string | null>(null);
    const [tables, setTables] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        let isCancelled = false;
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        let activeChannel: ReturnType<typeof supabase.channel> | null = null;

        async function loadTablesOnly(targetRestaurantId: string) {
            try {
                const { data, error } = await supabase
                    .from('tables')
                    .select('*, waitress:profiles!waitress_id(full_name)')
                    .eq('restaurant_id', targetRestaurantId)
                    .order('number');

                if (error) {
                    console.error('Supabase Error:', error);
                    throw error;
                }

                if (isCancelled) return;

                if (!data) {
                    setTables([]);
                    return;
                }

                // Map real status and waiter name from database
                const tablesWithStatus = (data as any[]).map(t => ({
                    ...t,
                    status: t.waitress_id ? 'occupied' : 'free',
                    waitress_name: t.waitress?.full_name || null
                }));

                setTables(tablesWithStatus);
            } catch (error: any) {
                console.error('Error fetching tables:', error.message || error);
            }
        }

        async function initTablesAndRealtime() {
            try {
                // Get restaurant_id from profile once on mount
                const { data: { session } } = await supabase.auth.getSession();
                if (!session || isCancelled) return;

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('restaurant_id, full_name, is_super_admin, role, restaurants(name)')
                    .eq('id', session.user.id)
                    .single() as { data: any; error: any };

                if (isCancelled) return;

                if (profile?.full_name) {
                    setCurrentWaitress(profile.full_name);
                }
                setWaitressId(session.user.id);

                let targetRestaurantId = profile?.restaurant_id;

                // Permitir al Super Admin o Admin simular/probar un restaurante específico vía URL
                if ((profile?.is_super_admin || profile?.role === 'admin') && paramRestaurantId) {
                    targetRestaurantId = paramRestaurantId;
                    const { data: restData } = await (supabase
                        .from('restaurants' as any) as any)
                        .select('name')
                        .eq('id', paramRestaurantId)
                        .single();
                    if (!isCancelled && restData && (restData as any).name) {
                        setRestaurant(paramRestaurantId, (restData as any).name);
                    }
                } else if (profile?.restaurants?.name && targetRestaurantId) {
                    setRestaurant(targetRestaurantId, profile.restaurants.name);
                }

                if (!targetRestaurantId) {
                    if (!isCancelled) setLoading(false);
                    return;
                }

                await loadTablesOnly(targetRestaurantId);

                if (isCancelled) return;

                // Subscribe to real-time changes strictly isolated by restaurant_id
                activeChannel = supabase
                    .channel(`tables_changes_${targetRestaurantId}`)
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'tables',
                            filter: `restaurant_id=eq.${targetRestaurantId}`,
                        },
                        () => {
                            if (debounceTimer) clearTimeout(debounceTimer);
                            debounceTimer = setTimeout(() => {
                                loadTablesOnly(targetRestaurantId);
                            }, 150);
                        }
                    )
                    .subscribe();
            } catch (error: any) {
                console.error('Error initializing tables:', error.message || error);
            } finally {
                if (!isCancelled) {
                    setLoading(false);
                }
            }
        }

        initTablesAndRealtime();

        return () => {
            isCancelled = true;
            if (debounceTimer) clearTimeout(debounceTimer);
            if (activeChannel) {
                supabase.removeChannel(activeChannel);
            }
        };
    }, [supabase, paramRestaurantId]);

    const filteredTables = tables.filter(t =>
        t.number.toString().includes(searchTerm)
    );

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                <p className="text-slate-400 font-black uppercase tracking-widest text-xs">{t('loadingFloor')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">{restaurantName || 'OrderPoint'}</span>
                            {currentWaitress && (
                                <span className="text-[10px] font-black text-indigo-300 uppercase tracking-wider bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                                    {t('waitressOnDuty')}: {currentWaitress}
                                </span>
                            )}
                        </div>
                        <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-none">
                            {t('select')} <span className="text-emerald-500">{t('table')}</span>
                        </h2>
                    </div>
                    <button
                        onClick={async () => {
                            resetStore();
                            if (typeof window !== 'undefined') {
                                localStorage.removeItem('exo-server-storage');
                            }
                            await supabase.auth.signOut();
                            router.push('/login');
                        }}
                        className="p-3 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 active:scale-90 transition-transform group"
                        title={t('signOut')}
                    >
                        <LogOut className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                    </button>
                </div>

                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                        type="text"
                        placeholder={t('searchTablePlaceholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-800 border-none rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    />
                </div>
            </div>

            <TableGrid tables={filteredTables} />

            {tables.length === 0 && !loading && (
                <div className="text-center py-20 bg-slate-800/20 rounded-[32px] border-2 border-dashed border-slate-800">
                    <p className="text-slate-500 font-black uppercase tracking-widest text-xs italic">
                        {t('noTables')}
                    </p>
                </div>
            )}
        </div>
    );
}

export default function TablesPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
            </div>
        }>
            <TablesPageContent />
        </Suspense>
    );
}
