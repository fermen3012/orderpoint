'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { adminSupabase } from '@/lib/supabase/admin-client';
import { useAuth } from '@/components/auth/AuthContext';
import { getProductSchedule, toggleProductAvailability, applyScheduleToAllDays } from '@/actions/schedule';
import { Calendar, Check, X, Copy, Loader2, Save } from 'lucide-react';

const DAYS = [
    { id: 0, label: 'Domingo' },
    { id: 1, label: 'Lunes' },
    { id: 2, label: 'Martes' },
    { id: 3, label: 'Miércoles' },
    { id: 4, label: 'Jueves' },
    { id: 5, label: 'Viernes' },
    { id: 6, label: 'Sábado' }
];

export default function SchedulePage() {
    const t = useTranslations('admin');
    const { restaurantId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState<any[]>([]);

    // Determine current day (0-6)
    const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());

    // Map: productId -> { day -> isActive }
    // But since we fetch all schedule data, maybe simpler structure?
    // Let's store: schedules: Record<string, Record<number, boolean>>
    const [schedules, setSchedules] = useState<Record<string, Record<number, boolean>>>({});
    const [toggling, setToggling] = useState<string | null>(null);

    useEffect(() => {
        if (restaurantId) {
            loadData();
        }
    }, [restaurantId]);

    const loadData = async () => {
        setLoading(true);
        // 1. Fetch products
        const { data: productsData } = await (adminSupabase
            .from('products' as any) as any)
            .select('id, name, category_id, is_available, image_url, categories(name)')
            .eq('restaurant_id', restaurantId)
            .eq('is_available', true) // Only active products matter
            .order('name');

        if (productsData) {
            setProducts(productsData);

            // 2. Fetch ALL availability records
            const { data: availabilityData } = await (adminSupabase
                .from('product_availability' as any) as any)
                .select('product_id, day_of_week, is_active')
                .in('product_id', productsData.map((p: any) => p.id));

            // Process into map
            const newSchedules: Record<string, Record<number, boolean>> = {};

            // Initialize with DEFAULT TRUE (if no record exists, it's available)
            productsData.forEach((p: any) => {
                newSchedules[p.id] = {};
                DAYS.forEach(d => {
                    // Default logic: Available
                    newSchedules[p.id][d.id] = true;
                });
            });

            // Overlay actual database records
            if (availabilityData) {
                // If a product has ANY record, we must trust the records.
                // But wait, our rule is: "If NO records, available". "If RECORDS, check specific".
                // So if a product has records, any missing day is implicitly FALSE? Or we enforce explicit records?
                // Plan said: "If product HAS records, SOLO mostrar si existe entrada".
                // So implies: If has records, missing days are HIDDEN.

                // Let's flag products that have at least one record
                const productsWithRecords = new Set(availabilityData.map((a: any) => a.product_id));

                productsData.forEach((p: any) => {
                    if (productsWithRecords.has(p.id)) {
                        // Product has some restrictions. Initialize all to FALSE first for this product?
                        // Or just follow: if record exists -> use value. If not -> False.
                        DAYS.forEach(d => {
                            newSchedules[p.id][d.id] = false;
                        });
                    }
                });

                availabilityData.forEach((a: any) => {
                    if (!newSchedules[a.product_id]) newSchedules[a.product_id] = {};
                    newSchedules[a.product_id][a.day_of_week] = a.is_active;
                });
            }

            setSchedules(newSchedules);
        }
        setLoading(false);
    };

    const handleToggle = async (productId: string, day: number, currentState: boolean) => {
        if (!restaurantId) return;
        setToggling(`${productId}-${day}`);

        const newState = !currentState;

        // Optimistic update
        setSchedules(prev => ({
            ...prev,
            [productId]: {
                ...prev[productId],
                [day]: newState
            }
        }));

        await toggleProductAvailability(productId, restaurantId, day, newState);
        setToggling(null);
    };

    const handleApplyAll = async (productId: string) => {
        if (!restaurantId) return;
        if (!confirm('¿Aplicar esta configuración a todos los días de la semana? Esto habilitará el producto para todos los días.')) return;

        setToggling(`${productId}-all`);

        // Optimistic: Set all days to TRUE
        // Ideally we'd ask "Apply what to all?". Usually "Make Available All Week".
        const newState = true;

        setSchedules(prev => {
            const prodSched = { ...prev[productId] };
            DAYS.forEach(d => prodSched[d.id] = newState);
            return { ...prev, [productId]: prodSched };
        });

        await applyScheduleToAllDays(productId, restaurantId, newState);
        setToggling(null);
        // Reload to be sure of DB state (constraints etc)
        loadData();
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 lg:p-10 pb-32">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-secondary-900 tracking-tight">Programación Semanal</h1>
                    <p className="text-secondary-500 font-bold mt-1 text-sm md:text-base">Gestiona la disponibilidad de tus productos por día.</p>
                </div>
            </header>

            {/* Day Tabs */}
            <div className="flex overflow-x-auto gap-2 pb-4 mb-6 no-scrollbar">
                {DAYS.map(day => (
                    <button
                        key={day.id}
                        onClick={() => setSelectedDay(day.id)}
                        className={`
                            px-6 py-3 rounded-full font-black text-xs uppercase tracking-widest whitespace-nowrap transition-all
                            ${selectedDay === day.id
                                ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                                : 'bg-white text-secondary-500 border border-secondary-100 hover:bg-secondary-50'}
                        `}
                    >
                        {day.label}
                        {day.id === new Date().getDay() && <span className="ml-2 text-[10px] opacity-70">(Hoy)</span>}
                    </button>
                ))}
            </div>

            {/* Product List for Selected Day */}
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-secondary-900/5 border border-secondary-100 overflow-hidden">
                <div className="p-6 md:p-8 border-b border-secondary-50 flex justify-between items-center bg-secondary-50/30">
                    <h2 className="text-xl font-black text-secondary-900">Menú del {DAYS[selectedDay].label}</h2>
                    <span className="text-xs font-bold text-secondary-400 uppercase tracking-wider">{products.length} Productos</span>
                </div>

                <div className="divide-y divide-secondary-50">
                    {products.map(product => {
                        const isAvailable = schedules[product.id]?.[selectedDay] ?? true;
                        const isProcessing = toggling === `${product.id}-${selectedDay}`;

                        return (
                            <div key={product.id} className="p-4 md:p-6 flex items-center justify-between hover:bg-secondary-50/50 transition-colors gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 md:w-16 md:h-16 bg-secondary-100 rounded-2xl overflow-hidden flex-shrink-0">
                                        {product.image_url ? (
                                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-secondary-300">
                                                <Calendar className="w-6 h-6" />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-secondary-900 text-sm md:text-base">{product.name}</h3>
                                        <p className="text-xs text-secondary-500 font-bold uppercase tracking-wider">{product.categories?.name}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    {/* Toggle Switch */}
                                    <button
                                        onClick={() => handleToggle(product.id, selectedDay, isAvailable)}
                                        disabled={isProcessing}
                                        className={`
                                            relative w-14 h-8 rounded-full transition-colors flex items-center px-1
                                            ${isAvailable ? 'bg-primary-500' : 'bg-secondary-200'}
                                            ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                        `}
                                    >
                                        <div className={`
                                            w-6 h-6 rounded-full bg-white shadow-sm transition-transform transform
                                            ${isAvailable ? 'translate-x-6' : 'translate-x-0'}
                                        `} />
                                    </button>

                                    {/* Copy to All Button (Only visible if active?) Or always? */}
                                    <button
                                        onClick={() => handleApplyAll(product.id)}
                                        disabled={toggling === `${product.id}-all`}
                                        className="p-2 text-secondary-400 hover:text-primary-500 hover:bg-primary-50 rounded-xl transition-colors hidden sm:block"
                                        title="Habilitar todos los días"
                                    >
                                        {toggling === `${product.id}-all` ? <Loader2 className="w-5 h-5 animate-spin" /> : <Copy className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
