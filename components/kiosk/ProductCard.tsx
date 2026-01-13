'use client';

import Image from 'next/image';
import { ShoppingCart, Plus } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface ProductCardProps {
    id: string;
    name: string;
    description: string | null;
    price: number;
    imageUrl: string | null;
    isAvailable: boolean;
    onAddToCart: () => void;
    locale: string;
}

export function ProductCard({
    id,
    name,
    description,
    price,
    imageUrl,
    isAvailable,
    onAddToCart,
    locale,
}: ProductCardProps) {
    const t = useTranslations('kiosk');
    const [isPressed, setIsPressed] = useState(false);

    return (
        <button
            onClick={onAddToCart}
            disabled={!isAvailable}
            onTouchStart={() => setIsPressed(true)}
            onTouchEnd={() => setIsPressed(false)}
            onMouseDown={() => setIsPressed(true)}
            onMouseUp={() => setIsPressed(false)}
            onMouseLeave={() => setIsPressed(false)}
            className={`
        group relative w-full bg-white rounded-3xl shadow-sm overflow-hidden
        transition-all duration-300 touch-target animate-scale-in
        ${isAvailable
                    ? 'hover:shadow-2xl hover:-translate-y-2 active:scale-[0.98] cursor-pointer'
                    : 'opacity-60 cursor-not-allowed'
                }
        ${isPressed && isAvailable ? 'scale-[0.98]' : ''}
        border border-secondary-100/50
      `}
        >
            {/* Image Container */}
            <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-primary-50 to-secondary-50 overflow-hidden">
                {imageUrl ? (
                    <Image
                        src={imageUrl}
                        alt={name}
                        fill
                        className="object-cover group-hover:scale-110 group-hover:rotate-2 transition-transform duration-500 ease-out"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <ShoppingCart className="w-16 h-16 text-primary-200 animate-float" />
                    </div>
                )}

                {/* Availability Badge */}
                {!isAvailable && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                        <span className="text-white font-bold text-lg px-4 py-2 bg-red-500/90 rounded-2xl shadow-lg">
                            {t('notAvailable')}
                        </span>
                    </div>
                )}

                {/* Add to Cart Icon Overlay */}
                {isAvailable && (
                    <div className="absolute bottom-4 right-4 bg-primary-500 text-white p-3 rounded-2xl shadow-xl translate-y-12 group-hover:translate-y-0 transition-transform duration-300 ease-out">
                        <Plus className="w-6 h-6" />
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-5 text-left">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-xl text-secondary-900 line-clamp-2 tablet-text leading-tight">
                        {name}
                    </h3>
                </div>

                {description && (
                    <p className="text-secondary-600/70 text-sm mb-4 line-clamp-2 font-medium">
                        {description}
                    </p>
                )}

                <div className="flex items-center justify-between mt-auto">
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-secondary-400 uppercase tracking-wider">{t('price')}</span>
                        <span className="text-2xl font-black text-primary-600">
                            {formatPrice(price, locale === 'es' ? 'es-SV' : 'en-US')}
                        </span>
                    </div>

                    {isAvailable && (
                        <div className="bg-secondary-50 text-secondary-600 px-4 py-2 rounded-2xl font-bold text-sm border border-secondary-100 group-hover:bg-primary-500 group-hover:text-white group-hover:border-primary-500 transition-all duration-300">
                            <span className="hidden sm:inline">{t('add')}</span>
                            <Plus className="w-5 h-5 sm:hidden" />
                        </div>
                    )}
                </div>
            </div>
        </button>
    );
}
