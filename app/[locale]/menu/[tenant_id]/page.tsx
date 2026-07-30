import { supabase } from '@/lib/supabase/client';
import PublicMenuClient from '@/components/menu/PublicMenuClient';
import { Utensils, AlertTriangle } from 'lucide-react';

export const revalidate = 60; // Incremental Static Regeneration every 60 seconds

interface PageProps {
    params: Promise<{
        locale: string;
        tenant_id: string;
    }>;
}

export default async function PublicMenuPage({ params }: PageProps) {
    const resolvedParams = await params;
    const { locale, tenant_id } = resolvedParams;
    const activeLocale = (locale === 'en' || locale === 'es') ? locale : 'es';

    // UI Translations for the error views
    const i18n = {
        es: {
            notFoundTitle: 'Restaurante no encontrado',
            notFoundDesc: 'El menú que intentas cargar no existe o el identificador del restaurante no es válido.',
            backHome: 'Ir al inicio',
        },
        en: {
            notFoundTitle: 'Restaurant Not Found',
            notFoundDesc: 'The menu you are trying to load does not exist or the restaurant identifier is invalid.',
            backHome: 'Go to home',
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
            .select('id, name, logo_url')
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
        const categories = catResult.data || [];
        const products = prodResult.data || [];

        return (
            <PublicMenuClient 
                restaurant={restaurant} 
                categories={categories} 
                products={products} 
                locale={activeLocale} 
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
