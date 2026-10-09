'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import TableGrid from '@/components/exo/TableGrid';
import { Loader2, Search, LogOut } from 'lucide-react';
import { useRestaurantStore } from '@/store/restaurant-store';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

export default function TablesPage() {
    const t = useTranslations('exo');
    const supabase = createClient();
    const router = useRouter();
    const { restaurantName, setRestaurant } = useRestaurantStore();
    const [tables, setTables] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        async function fetchTables() {
            try {
                // Get restaurant_id from profile
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('restaurant_id, restaurants(name)')
                    .eq('id', session.user.id)
                    .single() as { data: any; error: any };

                if (!profile?.restaurant_id) return;

                // Set restaurant name in store if missing
                if (profile.restaurants?.name) {
                    setRestaurant(profile.restaurant_id, profile.restaurants.name);
                }

                // Fetch tables from database with waiter profile
                const { data, error } = await supabase
                    .from('tables')
                    .select('*, waitress:profiles!waitress_id(full_name)')
                    .eq('restaurant_id', profile.restaurant_id)
                    .order('number');

                if (error) {
                    console.error('Supabase Error:', error);
                    throw error;
                }

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
            } finally {
                setLoading(false);
            }
        }

        fetchTables();

        // Subscribe to real-time changes
        const channel = supabase
            .channel('tables_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, fetchTables)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase]);

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
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">{restaurantName || 'OrderPoint'}</span>
                        </div>
                        <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-none">
                            {t('select')} <span className="text-emerald-500">{t('table')}</span>
                        </h2>
                    </div>
                    <button
                        onClick={async () => {
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
