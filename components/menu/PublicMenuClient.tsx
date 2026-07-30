'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from '@/i18n/routing';
import { Globe, Utensils, Award } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

// Helper function to extract translated text from name/description objects
const getLocalizedValue = (field: any, currentLang: string): string => {
    if (!field) return '';
    let current = field;
    for (let i = 0; i < 5; i++) {
        if (typeof current === 'string') {
            const trimmed = current.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (parsed !== null && parsed !== undefined) {
                        current = parsed;
                        continue;
                    }
                } catch (e) {
                    try {
                        const fixed = trimmed.replace(/""/g, '"');
                        const parsed = JSON.parse(fixed);
                        if (parsed !== null && parsed !== undefined) {
                            current = parsed;
                            continue;
                        }
                    } catch (err) {}
                }
            }
            break;
        } else if (current && typeof current === 'object') {
            const foundKey = Object.keys(current).find(pk => pk.toLowerCase() === currentLang.toLowerCase());
            if (foundKey) {
                current = current[foundKey];
            } else {
                const esKey = Object.keys(current).find(pk => pk.toLowerCase() === 'es');
                if (esKey) {
                    current = current[esKey];
                } else {
                    const firstKey = Object.keys(current)[0];
                    current = firstKey ? current[firstKey] : '';
                }
            }
        } else {
            break;
        }
    }
    return typeof current === 'string' ? current : (current ? String(current) : '');
};

interface Category {
    id: string;
    name: string;
    image_url?: string | null;
    sort_order?: number;
}

interface Product {
    id: string;
    category_id: string | null;
    name: any;
    description: any | null;
    price: number;
    image_url: string | null;
}

interface Restaurant {
    id: string;
    name: string;
    logo_url?: string | null;
}

interface PublicMenuClientProps {
    restaurant: Restaurant;
    categories: Category[];
    products: Product[];
    locale: 'es' | 'en';
}

export default function PublicMenuClient({ restaurant, categories, products, locale }: PublicMenuClientProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [activeCategoryId, setActiveCategoryId] = useState<string>('');
    const categoryRefs = useRef<{ [key: string]: HTMLElement | null }>({});
    const isScrollingRef = useRef(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Group products by category
    const menuData = categories.map(cat => {
        const catProducts = products.filter(p => p.category_id === cat.id);
        return {
            category: cat,
            products: catProducts
        };
    }).filter(group => group.products.length > 0); // Only render categories with products

    useEffect(() => {
        if (menuData.length > 0 && !activeCategoryId) {
            setActiveCategoryId(menuData[0].category.id);
        }
    }, [menuData, activeCategoryId]);

    // Handle scroll observer to highlight active category in navigation
    useEffect(() => {
        const handleScroll = () => {
            if (isScrollingRef.current) return;

            const scrollPosition = window.scrollY + 140; // Offset for header + category bar

            // Find which category section is currently in view
            for (let i = menuData.length - 1; i >= 0; i--) {
                const group = menuData[i];
                const element = categoryRefs.current[group.category.id];
                if (element) {
                    const offsetTop = element.offsetTop;
                    if (scrollPosition >= offsetTop) {
                        setActiveCategoryId(group.category.id);
                        break;
                    }
                }
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [menuData]);

    const scrollToCategory = (categoryId: string) => {
        const element = categoryRefs.current[categoryId];
        if (element) {
            isScrollingRef.current = true;
            setActiveCategoryId(categoryId);
            
            const offset = 120; // Offset for header + navigation bar
            const elementPosition = element.getBoundingClientRect().top + window.scrollY;
            const offsetPosition = elementPosition - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });

            // Re-enable scroll observer after scroll animation finishes
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
            scrollTimeoutRef.current = setTimeout(() => {
                isScrollingRef.current = false;
            }, 800);
        }
    };

    const toggleLanguage = () => {
        const nextLocale = locale === 'es' ? 'en' : 'es';
        router.replace(pathname, { locale: nextLocale });
    };

    // Dictionary for basic interface translations
    const i18n = {
        es: {
            menu: 'Menú',
            noProducts: 'No hay platillos disponibles en este momento.',
            categories: 'Categorías',
            backToTop: 'Volver arriba',
            language: 'ENGLISH'
        },
        en: {
            menu: 'Menu',
            noProducts: 'No dishes available at the moment.',
            categories: 'Categories',
            backToTop: 'Back to top',
            language: 'ESPAÑOL'
        }
    }[locale];

    return (
        <div className="max-w-md mx-auto min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-orange-500/30">
            {/* Header Sticky */}
            <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-900/60 px-4 py-3 flex items-center justify-between transition-all duration-300">
                <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-[16px] bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-[0_4px_12px_rgba(249,115,22,0.2)] overflow-hidden">
                        {restaurant.logo_url ? (
                            <Image 
                                src={restaurant.logo_url} 
                                alt={restaurant.name}
                                fill
                                sizes="40px"
                                className="object-cover"
                            />
                        ) : (
                            <Utensils className="w-5 h-5 text-slate-950" />
                        )}
                    </div>
                    <div>
                        <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] leading-none block mb-0.5">{i18n.menu}</span>
                        <h1 className="text-base font-black italic tracking-tighter uppercase leading-none text-white max-w-[200px] truncate">
                            {restaurant.name}
                        </h1>
                    </div>
                </div>
                
                <button
                    onClick={toggleLanguage}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 rounded-[16px] hover:bg-slate-800 active:scale-95 transition-all text-slate-400 hover:text-white"
                >
                    <Globe className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-wider">
                        {i18n.language}
                    </span>
                </button>
            </header>

            {/* Navigation Slider Sticky */}
            {menuData.length > 0 && (
                <div className="sticky top-[65px] z-40 bg-slate-950/90 backdrop-blur-xl border-b border-slate-900/40 py-3 px-4 overflow-x-auto scrollbar-none flex gap-2">
                    {menuData.map(group => {
                        const isSelected = activeCategoryId === group.category.id;
                        return (
                            <button
                                key={group.category.id}
                                onClick={() => scrollToCategory(group.category.id)}
                                className={`flex-shrink-0 px-4 py-2 text-xs font-black uppercase tracking-widest transition-all duration-300 rounded-[32px] ${
                                    isSelected 
                                        ? 'bg-orange-500 text-slate-950 shadow-[0_6px_20px_rgba(249,115,22,0.25)] scale-105' 
                                        : 'bg-slate-900 text-slate-400 border border-slate-800/80 hover:text-white'
                                }`}
                            >
                                {getLocalizedValue(group.category.name, locale)}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Menu List */}
            <main className="flex-1 px-4 py-6 space-y-8">
                {menuData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                        <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-[32px] flex items-center justify-center">
                            <Award className="w-8 h-8 text-slate-500" />
                        </div>
                        <p className="text-slate-400 font-bold text-sm max-w-xs leading-relaxed">
                            {i18n.noProducts}
                        </p>
                    </div>
                ) : (
                    menuData.map(group => (
                        <section 
                            key={group.category.id}
                            id={group.category.id}
                            ref={el => { categoryRefs.current[group.category.id] = el; }}
                            className="space-y-4 scroll-mt-36"
                        >
                            <h2 className="text-lg font-black italic tracking-tighter uppercase text-slate-100 flex items-center gap-2 border-l-4 border-orange-500 pl-3">
                                {getLocalizedValue(group.category.name, locale)}
                            </h2>
                            
                            <div className="grid grid-cols-1 gap-3.5">
                                {group.products.map(product => {
                                    const productName = getLocalizedValue(product.name, locale);
                                    const productDesc = getLocalizedValue(product.description, locale);
                                    
                                    return (
                                        <div 
                                            key={product.id}
                                            className="bg-slate-900/50 border border-slate-900 p-4 rounded-[32px] hover:bg-slate-900/80 transition-all duration-300 flex items-start justify-between gap-4 group"
                                        >
                                            <div className="flex-1 flex flex-col justify-between min-h-[80px]">
                                                <div>
                                                    <h3 className="font-black text-slate-100 text-sm md:text-base uppercase tracking-tight group-hover:text-orange-500 transition-colors">
                                                        {productName}
                                                    </h3>
                                                    {productDesc && (
                                                        <p className="text-slate-400 text-xs font-medium leading-relaxed mt-1 line-clamp-3">
                                                            {productDesc}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="text-orange-500 font-black text-sm md:text-base mt-2 tracking-tight">
                                                    {formatPrice(product.price)}
                                                </div>
                                            </div>

                                            {product.image_url && (
                                                <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-[32px] overflow-hidden flex-shrink-0 border border-slate-800/40 bg-slate-950 shadow-md">
                                                    <Image 
                                                        src={product.image_url} 
                                                        alt={productName}
                                                        fill
                                                        sizes="(max-w-md) 96px, 96px"
                                                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    ))
                )}
            </main>

            {/* Footer */}
            <footer className="py-8 text-center text-slate-600 text-[10px] font-bold uppercase tracking-widest border-t border-slate-900/50 mx-4">
                <p>© {new Date().getFullYear()} {restaurant.name}</p>
                <p className="mt-1 text-slate-700">Powered by OrderPoint</p>
            </footer>
        </div>
    );
}
