'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import TableGrid from '@/components/exo/TableGrid';
import { Loader2, Search } from 'lucide-react';

export default function TablesPage() {
    const supabase = createClient();
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
                    .select('restaurant_id')
                    .eq('id', session.user.id)
                    .single() as { data: any; error: any };

                if (!profile?.restaurant_id) return;

                // Fetch tables from database
                const { data, error } = await supabase
                    .from('tables')
                    .select('*')
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

                // For demo/consistency with request, we'll map them
                const mockStatusData = (data as any[]).map(t => ({
                    ...t,
                    status: Math.random() > 0.7 ? 'occupied' : 'free'
                }));

                setTables(mockStatusData);
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
                <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Cargando Salón...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-none">
                    Selecciona <span className="text-emerald-500">Mesa</span>
                </h2>

                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Buscar mesa..."
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
                        No hay mesas configuradas
                    </p>
                </div>
            )}
        </div>
    );
}
