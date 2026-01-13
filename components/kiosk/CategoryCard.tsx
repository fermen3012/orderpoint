'use client';

import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface CategoryCardProps {
    id: string;
    name: string;
    imageUrl: string | null;
    productCount?: number;
    onClick: () => void;
}

export function CategoryCard({
    id,
    name,
    imageUrl,
    productCount,
    onClick,
}: CategoryCardProps) {
    const t = useTranslations('kiosk');
    const [isPressed, setIsPressed] = useState(false);

    return (
        <button
            onClick={onClick}
            onTouchStart={() => setIsPressed(true)}
            onTouchEnd={() => setIsPressed(false)}
            onMouseDown={() => setIsPressed(true)}
            onMouseUp={() => setIsPressed(false)}
            onMouseLeave={() => setIsPressed(false)}
            className={`
        group relative w-full bg-white rounded-3xl shadow-sm overflow-hidden
        transition-all duration-300 touch-target animate-scale-in
        hover:shadow-2xl hover:-translate-y-1 active:scale-[0.98] cursor-pointer
        ${isPressed ? 'scale-[0.98]' : ''}
        border border-secondary-100/50
      `}
        >
            {/* Image Container */}
            <div className="relative w-full aspect-[16/9] bg-gradient-to-br from-primary-100 via-accent-50 to-secondary-100 overflow-hidden">
                {imageUrl ? (
                    <Image
                        src={imageUrl}
                        alt={name}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="text-6xl animate-float">🍽️</div>
                    </div>
                )}

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-secondary-900/80 via-secondary-900/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />

                {/* Content Overlay */}
                <div className="absolute inset-0 flex flex-col justify-end p-6">
                    <div className="flex items-end justify-between">
                        <div className="text-left">
                            <h3 className="font-black text-3xl text-white mb-1 drop-shadow-md tablet-heading tracking-tight">
                                {name}
                            </h3>
                            {productCount !== undefined && (
                                <div className="inline-flex items-center px-3 py-1 bg-white/20 backdrop-blur-md rounded-full border border-white/30">
                                    <p className="text-white text-xs font-bold uppercase tracking-widest">
                                        {t('productCount', { count: productCount })}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="bg-primary-500 p-3 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                            <ChevronRight className="w-6 h-6 text-white" />
                        </div>
                    </div>
                </div>
            </div>
        </button>
    );
}
