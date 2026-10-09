'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { adminSupabase } from '@/lib/supabase/admin-client';
import { useAuth } from '@/components/auth/AuthContext';
import { getProductSchedule, toggleProductAvailability, applyScheduleToAllDays } from '@/actions/schedule';
import { Calendar, Check, X, Copy, Loader2, Save } from 'lucide-react';
import { getLocalizedValue } from '@/lib/utils';

const DAYS = [
    { id: 0, key: 'sunday' },
    { id: 1, key: 'monday' },
    { id: 2, key: 'tuesday' },
    { id: 3, key: 'wednesday' },
    { id: 4, key: 'thursday' },
    { id: 5, key: 'friday' },
    { id: 6, key: 'saturday' }
];

export default function SchedulePage() {
    const t = useTranslations('admin');
    const locale = useLocale();
    const { restaurantId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState<any[]>([]);

    // Determine current day (0-6)
    const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());

    // Map: productId -> { day -> isActive }
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
                    newSchedules[p.id][d.id] = true;
                });
            });

            // Overlay actual database records
            if (availabilityData) {
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
        if (!confirm(t('confirmApplyAll'))) return;

        setToggling(`${productId}-all`);

        const newState = true;

        setSchedules(prev => {
            const prodSched = { ...prev[productId] };
            DAYS.forEach(d => prodSched[d.id] = newState);
            return { ...prev, [productId]: prodSched };
        });

        await applyScheduleToAllDays(productId, restaurantId, newState);
        setToggling(null);
        loadData();
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">{t('loadingData')}</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 lg:p-10 pb-32">
             <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-8 h-1 bg-emerald-500 rounded-full"></span>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">{t('planning')}</span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">{t('weeklySchedule')}</h1>
                    <p className="text-slate-400 font-bold mt-3 text-[10px] uppercase tracking-widest">{t('weeklyScheduleDesc')}</p>
                </div>
            </header>

            {/* Day Tabs */}
            <div className="flex overflow-x-auto gap-2 pb-4 mb-6 no-scrollbar">
                {DAYS.map(day => (
                    <button
                        key={day.id}
                        onClick={() => setSelectedDay(day.id)}
                        className={`
                            px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest whitespace-nowrap transition-all border
                            ${selectedDay === day.id
                                ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-lg shadow-emerald-500/20'
                                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800/80 hover:text-white'}
                        `}
                    >
                        {t(day.key as any)}
                        {day.id === new Date().getDay() && (
                            <span className={`ml-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${selectedDay === day.id ? 'bg-slate-950/20 text-slate-950' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                {t('todaySuffix') || 'Hoy'}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Product List for Selected Day */}
            <div className="bg-slate-900/40 backdrop-blur-md rounded-[2.5rem] shadow-xl border border-slate-800/80 overflow-hidden">
                <div className="p-6 md:p-8 border-b border-slate-800/80 flex justify-between items-center bg-slate-900/60">
                    <h2 className="text-xl font-black text-white uppercase italic tracking-tight">{t('menuOfDay', { day: t(DAYS[selectedDay].key as any) })}</h2>
                    <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 uppercase tracking-wider">{t('productsCount', { count: products.length })}</span>
                </div>

                <div className="divide-y divide-slate-800/50">
                    {products.map(product => {
                        const isAvailable = schedules[product.id]?.[selectedDay] ?? true;
                        const isProcessing = toggling === `${product.id}-${selectedDay}`;

                        return (
                            <div key={product.id} className="p-4 md:p-6 flex items-center justify-between hover:bg-slate-800/30 transition-colors gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 md:w-16 md:h-16 bg-slate-800 rounded-2xl overflow-hidden flex-shrink-0 border border-slate-700/60">
                                        {product.image_url ? (
                                            <img src={product.image_url} alt={getLocalizedValue(product.name, locale)} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                                                <Calendar className="w-6 h-6" />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-black text-white text-sm md:text-base uppercase tracking-tight">
                                            {getLocalizedValue(product.name, locale)}
                                        </h3>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">{getLocalizedValue(product.categories?.name, locale)}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border hidden sm:inline-block ${
                                        isAvailable ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'
                                    }`}>
                                        {isAvailable ? (locale === 'es' ? 'Disponible' : 'Available') : (locale === 'es' ? 'Pausado' : 'Paused')}
                                    </span>

                                    {/* Toggle Switch */}
                                    <button
                                        onClick={() => handleToggle(product.id, selectedDay, isAvailable)}
                                        disabled={isProcessing}
                                        className={`
                                            relative w-14 h-8 rounded-full transition-colors flex items-center px-1 border
                                            ${isAvailable ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-800 border-slate-700'}
                                            ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                        `}
                                    >
                                        <div className={`
                                            w-6 h-6 rounded-full bg-slate-950 shadow-md transition-transform transform flex items-center justify-center
                                            ${isAvailable ? 'translate-x-6' : 'translate-x-0'}
                                        `}>
                                            {isAvailable ? <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" /> : <X className="w-3.5 h-3.5 text-slate-500 stroke-[3]" />}
                                        </div>
                                    </button>

                                    {/* Copy to All Button */}
                                    <button
                                        onClick={() => handleApplyAll(product.id)}
                                        disabled={toggling === `${product.id}-all`}
                                        className="p-2.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-2xl border border-transparent hover:border-emerald-500/20 transition-all hidden sm:block active:scale-90"
                                        title={t('enableAllDays')}
                                    >
                                        {toggling === `${product.id}-all` ? <Loader2 className="w-5 h-5 animate-spin text-emerald-400" /> : <Copy className="w-5 h-5" />}
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
