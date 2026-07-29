'use client';

import { cn } from '@/lib/utils';
import { ChefHat, Pizza, Beer, IceCream, UtensilsCrossed } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Category {
    id: string;
    name: string;
    image_url?: string | null;
}

interface CategorySidebarProps {
    categories: Category[];
    activeCategory: string | null;
    onSelect: (id: string | null) => void;
}

const getCategoryIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('hamburguesa') || n.includes('burger')) return <UtensilsCrossed className="w-8 h-8" />;
    if (n.includes('pizza')) return <Pizza className="w-8 h-8" />;
    if (n.includes('bebida') || n.includes('drink')) return <Beer className="w-8 h-8" />;
    if (n.includes('postre') || n.includes('dessert')) return <IceCream className="w-8 h-8" />;
    return <ChefHat className="w-8 h-8" />;
};

export function CategorySidebar({ categories, activeCategory, onSelect }: CategorySidebarProps) {
    const t = useTranslations('kiosk');
    return (
        <aside className="w-full md:w-64 h-auto md:h-full bg-white border-b md:border-b-0 md:border-r border-secondary-100 flex flex-col overflow-hidden z-20">
            {/* Logo/Branding spot can go here */}
            <div className="hidden md:flex p-6 border-b border-secondary-100 items-center justify-center">
                <div className="w-12 h-12 bg-primary-500 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-200">
                    <span className="text-white font-black text-xl">O</span>
                </div>
            </div>

            <nav className="flex-1 overflow-x-auto md:overflow-y-auto scrollbar-hide py-4 md:py-6 px-4 space-x-4 md:space-x-0 md:space-y-4 flex flex-row md:flex-col">
                {/* "All" category button */}
                <button
                    onClick={() => onSelect(null)}
                    className={cn(
                        "flex flex-col items-center justify-center min-w-[100px] md:min-w-0 h-24 md:h-32 rounded-[2rem] transition-all duration-300 active:scale-95 shrink-0",
                        activeCategory === null
                            ? "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-xl shadow-green-500/30"
                            : "text-secondary-400 hover:bg-green-50"
                    )}
                >
                    <UtensilsCrossed className={cn("w-8 h-8 mb-2", activeCategory === null ? "text-white" : "text-secondary-300")} />
                    <span className="text-xs font-black uppercase tracking-widest">{t('all')}</span>
                </button>

                {categories.map((category) => (
                    <button
                        key={category.id}
                        onClick={() => onSelect(category.id)}
                        className={cn(
                            "flex flex-col items-center justify-center min-w-[100px] md:min-w-0 h-24 md:h-32 rounded-[2rem] transition-all duration-300 active:scale-95 shrink-0",
                            activeCategory === category.id
                                ? "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-xl shadow-green-500/30"
                                : "text-secondary-400 hover:bg-green-50"
                        )}
                    >
                        {category.image_url ? (
                            <img src={category.image_url} alt={category.name} className="w-12 h-12 object-contain mb-2" />
                        ) : (
                            <div className={cn("mb-2", activeCategory === category.id ? "text-white" : "text-secondary-300")}>
                                {getCategoryIcon(category.name)}
                            </div>
                        )}
                        <span className="text-xs font-black uppercase tracking-widest text-center px-2 truncate w-full">
                            {category.name}
                        </span>
                    </button>
                ))}
            </nav>
        </aside>
    );
}
