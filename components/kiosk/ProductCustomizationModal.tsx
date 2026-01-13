'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { X, Check, Minus, Plus, ShoppingCart } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import Image from 'next/image';

interface Ingredient {
    id: string;
    name: string;
}

interface ProductIngredient {
    ingredient_id: string;
    is_removable: boolean;
    ingredients: Ingredient;
}

interface ProductCustomizationModalProps {
    product: any;
    ingredients: ProductIngredient[];
    onClose: () => void;
    onConfirm: (removedIngredientIds: string[]) => void;
    locale: string;
}

export function ProductCustomizationModal({
    product,
    ingredients,
    onClose,
    onConfirm,
    locale
}: ProductCustomizationModalProps) {
    const t = useTranslations('kiosk');
    const [removedIngredients, setRemovedIngredients] = useState<string[]>([]);

    const toggleIngredient = (id: string) => {
        if (removedIngredients.includes(id)) {
            setRemovedIngredients(prev => prev.filter(item => item !== id));
        } else {
            setRemovedIngredients(prev => [...prev, id]);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-6 bg-secondary-900/80 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
            <div className="bg-white w-full max-w-2xl rounded-[2rem] sm:rounded-[3rem] shadow-2xl overflow-hidden animate-scale-in flex flex-col my-auto max-h-[95vh]">
                {/* Header */}
                <div className="relative h-40 sm:h-64 flex-shrink-0">
                    {product.image_url ? (
                        <Image
                            src={product.image_url}
                            alt={product.name}
                            fill
                            className="object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-primary-50 flex items-center justify-center">
                            <ShoppingCart className="w-16 sm:w-20 h-16 sm:h-20 text-primary-200" />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <button
                        onClick={onClose}
                        className="absolute top-4 sm:top-6 right-4 sm:right-6 p-2 sm:p-3 bg-white/20 backdrop-blur-md hover:bg-white/40 rounded-xl sm:rounded-2xl text-white transition-all touch-target"
                    >
                        <X className="w-5 sm:w-6 h-5 sm:h-6" />
                    </button>
                    <div className="absolute bottom-4 sm:bottom-6 left-6 sm:left-8 right-6 sm:right-8">
                        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight mb-0.5 sm:mb-1">
                            {product.name}
                        </h2>
                        <p className="text-white/90 font-bold text-base sm:text-lg">
                            {formatPrice(Number(product.price), locale === 'es' ? 'es-SV' : 'en-US')}
                        </p>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
                    <div className="mb-4 sm:mb-8">
                        <h3 className="text-[10px] sm:text-xs font-black text-secondary-400 uppercase tracking-widest mb-2 sm:mb-4">
                            {t('customizeTitle')}
                        </h3>
                        <p className="text-sm sm:text-base text-secondary-600 font-medium mb-4 sm:mb-6">
                            {t('customizeDesc', { product: product.name.toLowerCase() })}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            {ingredients.map((pi) => {
                                const isRemoved = removedIngredients.includes(pi.ingredient_id);
                                return (
                                    <button
                                        key={pi.ingredient_id}
                                        onClick={() => pi.is_removable && toggleIngredient(pi.ingredient_id)}
                                        disabled={!pi.is_removable}
                                        className={`
                                            flex items-center justify-between p-4 sm:p-5 rounded-2xl sm:rounded-3xl border-2 transition-all duration-300 text-left
                                            ${isRemoved
                                                ? 'bg-red-50 border-red-200 shadow-inner'
                                                : 'bg-white border-secondary-100 hover:border-primary-200 hover:shadow-lg'
                                            }
                                            ${!pi.is_removable ? 'opacity-50 grayscale cursor-not-allowed' : 'active:scale-95'}
                                        `}
                                    >
                                        <div className="flex flex-col">
                                            <span className={`font-black text-base sm:text-lg ${isRemoved ? 'text-red-600 line-through' : 'text-secondary-900'}`}>
                                                {pi.ingredients.name}
                                            </span>
                                            <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${isRemoved ? 'text-red-400' : 'text-secondary-400'}`}>
                                                {pi.is_removable ? (isRemoved ? t('removed') : t('included')) : t('requiredIngredient')}
                                            </span>
                                        </div>
                                        <div className={`
                                            w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center transition-all
                                            ${isRemoved ? 'bg-red-500 text-white rotate-90' : 'bg-primary-500 text-white'}
                                        `}>
                                            {isRemoved ? <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> : <Check className="w-4 h-4 sm:w-5 sm:h-5" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 sm:p-8 bg-secondary-50 border-t border-secondary-100 flex-shrink-0">
                    <button
                        onClick={() => onConfirm(removedIngredients)}
                        className="w-full bg-primary-500 hover:bg-primary-600 text-white font-black py-4 sm:py-6 rounded-2xl sm:rounded-[2.5rem] transition-all duration-300 shadow-xl shadow-primary-200 hover:shadow-primary-300 hover:-translate-y-1 active:scale-[0.98] flex items-center justify-center gap-2 sm:gap-3"
                    >
                        <span className="text-lg sm:text-xl uppercase tracking-widest">{t('addToCart')}</span>
                        <Check className="w-5 sm:w-6 h-5 sm:h-6" />
                    </button>
                </div>
            </div>
        </div>
    );
}
