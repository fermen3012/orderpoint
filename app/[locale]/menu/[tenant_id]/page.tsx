import { supabase } from '@/lib/supabase/client';
import PublicMenuClient from '@/components/menu/PublicMenuClient';
import { Utensils, AlertTriangle } from 'lucide-react';
import { getLocale } from 'next-intl/server';

export const revalidate = 60; // Incremental Static Regeneration every 60 seconds

interface PageProps {
    params: Promise<{
        locale: string;
        tenant_id: string;
    }>;
}

export default async function PublicMenuPage({ params }: PageProps) {
    const resolvedParams = await params;
    const { tenant_id } = resolvedParams;
    const resolvedLocale = await getLocale();
    const activeLocale = (resolvedLocale === 'en' || resolvedLocale === 'es') ? resolvedLocale : 'es';

    // UI Translations for the error views
    const i18n = {
        es: {
            notFoundTitle: 'Restaurante no encontrado',
            notFoundDesc: 'El menú que intentas cargar no existe o el identificador del restaurante no es válido.',
            backHome: 'Ir al inicio',
            suspendedTitle: 'Restaurante Inactivo',
            suspendedDesc: 'Este restaurante se encuentra temporalmente fuera de servicio por administración.',
        },
        en: {
            notFoundTitle: 'Restaurant Not Found',
            notFoundDesc: 'The menu you are trying to load does not exist or the restaurant identifier is invalid.',
            backHome: 'Go to home',
            suspendedTitle: 'Restaurant Inactive',
            suspendedDesc: 'This restaurant is temporarily unavailable by administration.',
        }
    }[activeLocale];

    // UUID Regex Validation to prevent query errors
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!tenant_id || !uuidRegex.test(tenant_id)) {
        return (
            <div className="max-w-md mx-auto min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center font-sans">
                <div className="w-20 h-20 bg-slate-900 border border-slate-800 rounded-[32px] flex items-center justify-center mb-6 shadow-xl">
                    <AlertTriangle className="w-10 h-10 text-orange-500" />
                </div>
                <h1 className="text-2xl font-black italic tracking-tighter uppercase mb-3 text-white">
                    {i18n.notFoundTitle}
                </h1>
                <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-xs">
                    {i18n.notFoundDesc}
                </p>
            </div>
        );
    }

    try {
        // Fetch restaurant, categories and products sequentially using public client with casting to avoid TS database type errors
        const restResult = await (supabase.from('restaurants') as any)
            .select('id, name, logo_url, is_active')
            .eq('id', tenant_id)
            .single();

        const catResult = await (supabase.from('categories') as any)
            .select('id, name, sort_order')
            .eq('restaurant_id', tenant_id)
            .order('sort_order', { ascending: true });

        const prodResult = await (supabase.from('products') as any)
            .select('id, category_id, name, description, price, image_url, is_available')
            .eq('restaurant_id', tenant_id)
            .eq('is_available', true);

        if (restResult.error || !restResult.data) {
            console.error('Error fetching restaurant:', restResult.error);
            return (
                <div className="max-w-md mx-auto min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center font-sans">
                    <div className="w-20 h-20 bg-slate-900 border border-slate-800 rounded-[32px] flex items-center justify-center mb-6 shadow-xl">
                        <AlertTriangle className="w-10 h-10 text-orange-500" />
                    </div>
                    <h1 className="text-2xl font-black italic tracking-tighter uppercase mb-3 text-white">
                        {i18n.notFoundTitle}
                    </h1>
                    <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-xs">
                        {i18n.notFoundDesc}
                    </p>
                </div>
            );
        }

        const restaurant = restResult.data;

        if (restaurant.is_active === false) {
            return (
                <div className="max-w-md mx-auto min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center font-sans">
                    <div className="w-20 h-20 bg-rose-500/10 border-2 border-rose-500/30 rounded-[32px] flex items-center justify-center mb-6 shadow-xl animate-pulse">
                        <AlertTriangle className="w-10 h-10 text-rose-500" />
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500">
                            {restaurant.name || 'OrderPoint'}
                        </span>
                    </div>
                    <h1 className="text-2xl font-black italic tracking-tighter uppercase mb-3 text-white">
                        {i18n.suspendedTitle}
                    </h1>
                    <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-xs">
                        {i18n.suspendedDesc}
                    </p>
                </div>
            );
        }

        const categories = catResult.data || [];
        const products = prodResult.data || [];

        return (
            <PublicMenuClient 
                restaurant={restaurant} 
                categories={categories} 
                products={products} 
            />
        );

    } catch (err) {
        console.error('Unexpected error in PublicMenuPage:', err);
        return (
            <div className="max-w-md mx-auto min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center font-sans">
                <div className="w-20 h-20 bg-slate-900 border border-slate-800 rounded-[32px] flex items-center justify-center mb-6 shadow-xl">
                    <AlertTriangle className="w-10 h-10 text-orange-500" />
                </div>
                <h1 className="text-2xl font-black italic tracking-tighter uppercase mb-3 text-white">
                    {i18n.notFoundTitle}
                </h1>
                <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-xs">
                    {i18n.notFoundDesc}
                </p>
            </div>
        );
    }
}
