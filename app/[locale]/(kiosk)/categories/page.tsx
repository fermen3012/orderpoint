'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { ChefHat, ArrowRight, Loader2, Star, Sparkles, Utensils } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { useAuth } from '@/components/auth/AuthContext';
import LanguageSwitcher from '@/components/kiosk/LanguageSwitcher';
import type { Database } from '@/lib/supabase/types';
import Image from 'next/image';

import { getMenuWithSchedule } from '@/actions/products';

type Category = Database['public']['Tables']['categories']['Row'];

export default function CategoriesPage({ params }: { params: Promise<{ locale: string }> }) {
    const resolvedParams = use(params);
    const locale = resolvedParams.locale;
    const router = useRouter();
    const t = useTranslations('kiosk');
    const { restaurantId } = useAuth();
    const supabase = createClient();

    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadCategories() {
            if (!restaurantId) return;
            try {
                // Fetch categories and available products (today)
                const [categoriesRes, productsRes] = await Promise.all([
                    supabase
                        .from('categories')
                        .select('*')
                        .eq('restaurant_id', restaurantId)
                        .order('sort_order'),
                    getMenuWithSchedule(restaurantId, new Date().getDay())
                ]);

                if (categoriesRes.data && productsRes) {
                    const availableProducts = productsRes;
                    const activeCategoryIds = new Set((availableProducts as any[]).map(p => p.category_id));

                    const visibleCategories = (categoriesRes.data as any[]).filter(cat => activeCategoryIds.has(cat.id));
                    setCategories(visibleCategories);
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }
        loadCategories();
    }, [restaurantId, supabase]);

    const handleCategoryClick = (categoryId: string) => {
        router.push(`/menu?category_id=${categoryId}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 p-6 md:p-12 pb-32 relative">
                <LanguageSwitcher className="absolute top-8 right-8 z-50" />
                <div className="max-w-7xl mx-auto">
                    <div className="min-h-screen flex items-center justify-center">
                        <Loader2 className="w-16 h-16 animate-spin text-primary-500" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full relative overflow-x-hidden bg-slate-50 text-slate-900 selection:bg-primary-500 selection:text-white">
            <LanguageSwitcher className="absolute top-8 right-8 z-50" />

            {/* Dynamic Background - Fresh Food Theme */}
            <div className="absolute inset-0 z-0">
                {/* Image: Light, fresh ingredients */}
                <Image
                    src="https://images.unsplash.com/photo-1493770348161-369560ae357d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80"
                    alt="Background"
                    fill
                    priority
                    className="object-cover opacity-40 fixed"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-slate-50/60 to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0)_0%,rgba(248,250,252,0.5)_100%)]" />
            </div>

            <div className="relative z-10 container mx-auto px-4 py-8 md:py-12 flex flex-col min-h-screen">

                {/* Header */}
                <header className="mb-16 text-center animate-in fade-in slide-in-from-top-10 duration-1000">
                    <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-white backdrop-blur-md border border-slate-200 mb-6 shadow-xl shadow-primary-500/5 hover:bg-slate-50 transition-colors cursor-default">
                        <Sparkles className="w-4 h-4 text-primary-500 animate-pulse" />
                        <span className="text-slate-500 text-xs font-black uppercase tracking-[0.3em]">{t('freshAndDelicious')}</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter uppercase italic drop-shadow-sm leading-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-700">
                        {t('ourMenu')}
                    </h1>
                    <p className="text-xl md:text-2xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed">
                        {t.rich('exploreFlavors', {
                            primary: (chunks) => <span className="text-primary-500 font-bold italic">{chunks}</span>
                        })}
                    </p>
                </header>

                {/* Categories Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">

                    {/* "All Menu" Special Card - Clean White Design */}
                    <button
                        onClick={() => router.push(`/menu`)}
                        className="group relative h-80 rounded-[3rem] overflow-hidden bg-white border border-slate-200 shadow-2xl shadow-slate-200/50 transition-all duration-500 hover:scale-[1.03] hover:shadow-[0_20px_50px_rgba(239,68,68,0.15)] animate-in fade-in zoom-in-50 fill-mode-backwards ring-4 ring-transparent hover:ring-primary-50"
                        style={{ animationDelay: '0ms' }}
                    >
                        {/* Abstract shapes */}
                        <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary-100/50 rounded-full blur-[80px] group-hover:bg-primary-200/50 transition-colors duration-700" />
                        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-orange-100/50 rounded-full blur-[80px]" />

                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 z-20">
                            <div className="w-24 h-24 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-8 group-hover:rotate-12 transition-transform duration-500 shadow-xl shadow-slate-200">
                                <Utensils className="w-10 h-10 text-primary-500 drop-shadow-sm" />
                            </div>
                            <h3 className="text-4xl font-black text-slate-900 italic tracking-tighter uppercase mb-2 group-hover:text-primary-500 transition-colors">
                                {t('fullMenu')}
                            </h3>
                            <div className="h-1.5 w-20 bg-primary-500 rounded-full mt-4 group-hover:w-32 transition-all duration-500" />
                            <div className="absolute bottom-10 flex items-center gap-2 text-slate-400 font-bold uppercase tracking-widest text-xs opacity-60 group-hover:opacity-100 transition-opacity">
                                {t('viewAll')} <ArrowRight className="w-4 h-4 text-primary-500" />
                            </div>
                        </div>
                    </button>

                    {/* Standard Categories */}
                    {categories.map((category, idx) => (
                        <button
                            key={category.id}
                            onClick={() => handleCategoryClick(category.id)}
                            className="group relative h-80 rounded-[3rem] overflow-hidden bg-white border border-slate-100 shadow-2xl shadow-slate-200/50 transition-all duration-500 hover:scale-[1.03] hover:shadow-[0_20px_60px_rgba(0,0,0,0.1)] animate-in fade-in zoom-in-50 fill-mode-backwards"
                            style={{ animationDelay: `${(idx + 1) * 150}ms` }}
                        >
                            {/* Background Image with Zoom Effect */}
                            <div className="absolute inset-0 z-0 bg-slate-100">
                                {category.image_url ? (
                                    <div className="w-full h-full relative">
                                        <div className="absolute inset-0 bg-white/0 z-10 transition-colors duration-500" />
                                        <Image
                                            src={category.image_url}
                                            alt={category.name}
                                            fill
                                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                            className="object-cover transition-transform duration-1000 ease-out group-hover:scale-110"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-full h-full bg-slate-50 flex items-center justify-center relative overflow-hidden">
                                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,0.05),transparent)]" />
                                        <ChefHat className="w-20 h-20 text-slate-200 group-hover:text-primary-200 transition-colors duration-500 transform group-hover:rotate-12" />
                                    </div>
                                )}
                                {/* Gradient overlay for text readability - Light to Dark */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-70 z-20" />
                            </div>

                            {/* Content */}
                            <div className="absolute inset-x-0 bottom-0 p-8 z-30 flex flex-col items-start text-left">
                                <div className="inline-block px-3 py-1 rounded-lg bg-white/20 backdrop-blur-md border border-white/20 text-white text-[10px] font-black uppercase tracking-widest mb-3 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                                    <div className="flex items-center gap-1">
                                        <Star className="w-3 h-3 fill-white" /> {t('explore')}
                                    </div>
                                </div>
                                <h3 className="text-4xl lg:text-5xl font-black text-white italic tracking-tighter uppercase leading-[0.9] drop-shadow-md mb-2 origin-left transform group-hover:scale-105 transition-transform duration-500">
                                    {category.name}
                                </h3>

                                <div className="w-full flex items-center justify-between mt-4 border-t border-white/20 pt-4 opacity-80 group-hover:opacity-100 transition-opacity duration-500">
                                    <span className="text-slate-200 text-xs font-bold uppercase tracking-wider group-hover:text-white">{t('viewProducts')}</span>
                                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:bg-primary-500 group-hover:text-white transition-all duration-300 transform group-hover:rotate-[-45deg] border border-white/10">
                                        <ArrowRight className="w-5 h-5 text-white" />
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
