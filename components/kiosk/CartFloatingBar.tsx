"use client";

import { useEffect, useState } from 'react';

import { useCartStore } from '@/store/cart-store';
import { ShoppingBag, ChevronUp } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { useTranslations } from 'next-intl';

export default function CartFloatingBar({ onOpenCart }: { onOpenCart: () => void }) {
    const { getCartTotal, getCartCount } = useCartStore();
    const t = useTranslations('kiosk');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // During SSR and initial hydration, use default values (count === 0)
    // Only access store values after mounting to avoid mismatch
    if (!mounted) return null;

    const total = getCartTotal();
    const count = getCartCount();

    if (count === 0) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 z-40 animate-in slide-in-from-bottom duration-500 fade-in">
            <div
                onClick={onOpenCart}
                className="max-w-4xl mx-auto bg-primary-600 text-white rounded-2xl shadow-2xl shadow-primary-900/20 p-4 flex items-center justify-between cursor-pointer hover:bg-primary-700 transition-colors group active:scale-[0.98]"
            >
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform relative">
                        <ShoppingBag className="w-6 h-6 text-white" />
                        <span className="absolute -top-2 -right-2 bg-accent-500 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-primary-600 shadow-sm">
                            {count}
                        </span>
                    </div>
                    <div>
                        <p className="text-xs uppercase font-black text-primary-200 tracking-wider mb-0.5">
                            {t('total')}
                        </p>
                        <p className="text-2xl font-black tabular-nums leading-none">
                            {formatPrice(total)}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-sm font-black uppercase tracking-widest hidden sm:inline-block">
                        {t('viewOrder')}
                    </span>
                    <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                        <ChevronUp className="w-6 h-6" />
                    </div>
                </div>
            </div>
        </div>
    );
}
