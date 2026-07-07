'use client';

import { useTranslations } from 'next-intl';
import { ShoppingCart, X, Minus, Plus, Trash2 } from 'lucide-react';
import { useCartStore } from '@/store/cart-store';
import { formatPrice } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import { useRestaurantStore } from '@/store/restaurant-store';
import { useEffect, useState } from 'react';
import Image from 'next/image';

interface CartProps {
    locale: string;
    onCheckout: () => void;
}

export function Cart({ locale, onCheckout }: CartProps) {
    const t = useTranslations('kiosk');
    const { items, removeFromCart, updateQuantity, getCartTotal, getCartCount } = useCartStore();
    const { restaurantId } = useRestaurantStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const itemCount = mounted ? getCartCount() : 0;
    const total = mounted ? getCartTotal() : 0;
    const cartItems = mounted ? items : [];

    if (itemCount === 0) {
        return (
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-4">
                <div className="flex items-center gap-3 mb-6">
                    <ShoppingCart className="w-6 h-6 text-primary-600" />
                    <h2 className="text-2xl font-bold text-gray-900">{t('cart')}</h2>
                </div>

                <div className="text-center py-12">
                    <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">{t('empty')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-3xl shadow-xl p-6 sticky top-4 border border-secondary-100/50 animate-in slide-in-from-bottom duration-500">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="bg-primary-100 p-2 rounded-2xl">
                        <ShoppingCart className="w-6 h-6 text-primary-600" />
                    </div>
                    <h2 className="text-2xl font-black text-secondary-900 tracking-tight">{t('cart')}</h2>
                </div>
                <span className="bg-primary-500 text-white px-4 py-1 rounded-full text-sm font-black shadow-lg shadow-primary-200">
                    {itemCount}
                </span>
            </div>

            {/* Cart Items */}
            <div className="space-y-6 mb-8 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {cartItems.map((item) => (
                    <div key={item.uniqueId} className="group animate-in scale-in duration-300">
                        <div className="flex gap-4">
                            {/* Item Image */}
                            {item.product.image_url && (
                                <div className="relative w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 bg-secondary-50 border border-secondary-100">
                                    <Image
                                        src={item.product.image_url}
                                        alt={item.product.name?.es || (typeof item.product.name === 'string' ? item.product.name : '')}
                                        fill
                                        className="object-cover group-hover:scale-110 transition-transform duration-300"
                                        sizes="80px"
                                    />
                                </div>
                            )}

                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                                <div>
                                    {/* Item Name */}
                                    <h3 className="font-bold text-secondary-900 truncate leading-tight">
                                        {item.product.name?.[locale] || item.product.name?.es || (typeof item.product.name === 'string' ? item.product.name : '')}
                                    </h3>

                                    {/* Modifiers */}
                                    {item.selectedModifiers.length > 0 && (
                                        <div className="text-[10px] text-secondary-400 mt-1 space-y-0.5 font-bold uppercase tracking-wider">
                                            {item.selectedModifiers.map((group) => (
                                                <div key={group.groupId}>
                                                    {group.options.map((opt) => opt.name).join(', ')}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Removed Ingredients */}
                                    {item.removedIngredients && item.removedIngredients.length > 0 && (
                                        <div className="text-[10px] text-red-400 mt-1 space-y-0.5 font-bold uppercase tracking-wider">
                                            {t('removed')}: {item.removedIngredients.map(ri => ri.name).join(', ')}
                                        </div>
                                    )}
                                </div>

                                {/* Price and Quantity Controls */}
                                <div className="flex items-center justify-between mt-2">
                                    <span className="font-black text-primary-600">
                                        {formatPrice(item.totalPrice, locale === 'es' ? 'es-SV' : 'en-US')}
                                    </span>

                                    <div className="flex items-center gap-3 bg-secondary-50 p-1 rounded-xl border border-secondary-100">
                                        <button
                                            onClick={() => updateQuantity(item.uniqueId, -1)}
                                            className="p-1 rounded-lg hover:bg-white hover:shadow-sm transition-all touch-target"
                                        >
                                            {item.quantity === 1 ? (
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            ) : (
                                                <Minus className="w-4 h-4 text-secondary-600" />
                                            )}
                                        </button>

                                        <span className="font-black text-secondary-900 min-w-[1.5ch] text-center text-sm">
                                            {item.quantity}
                                        </span>

                                        <button
                                            onClick={() => updateQuantity(item.uniqueId, 1)}
                                            className="p-1 rounded-lg hover:bg-white hover:shadow-sm transition-all touch-target"
                                        >
                                            <Plus className="w-4 h-4 text-secondary-600" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="h-px bg-secondary-50 mt-4 mx-2" />
                    </div>
                ))}
            </div>

            {/* Total Section */}
            <div className="bg-secondary-50 rounded-3xl p-6 mb-6 border border-secondary-100">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-secondary-400 uppercase tracking-widest">{t('total')}</span>
                    <span className="text-3xl font-black text-secondary-900">
                        {formatPrice(total, locale === 'es' ? 'es-SV' : 'en-US')}
                    </span>
                </div>
                <p className="text-[10px] text-secondary-400 font-bold uppercase tracking-tighter">{t('taxesIncluded')}</p>
            </div>

            {/* Checkout Button */}
            <button
                onClick={onCheckout}
                className="w-full bg-primary-500 hover:bg-primary-600 text-white font-black py-5 px-6 rounded-3xl transition-all duration-300 shadow-xl shadow-primary-200 hover:shadow-primary-300 hover:-translate-y-1 active:scale-[0.98] touch-target flex items-center justify-center gap-3"
            >
                <span className="text-lg uppercase tracking-widest">{t('checkout')}</span>
                <Plus className="w-6 h-6" />
            </button>
        </div>
    );
}
