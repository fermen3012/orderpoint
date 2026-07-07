'use client';

import { Product } from '@/types';
import { Plus, Minus, Info } from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';

import { useParams } from 'next/navigation';

interface ProductListItemProps {
    product: Product;
    quantity: number;
    onAdd: () => void;
    onRemove: () => void;
    onOpenModifiers: () => void;
}

export default function ProductListItem({ product, quantity, onAdd, onRemove, onOpenModifiers }: ProductListItemProps) {
    const params = useParams();
    const locale = (params?.locale as string) || 'es';
    const productName = product.name?.[locale] || product.name?.es || (typeof product.name === 'string' ? product.name : '');

    return (
        <div className="flex items-center gap-4 bg-slate-800/40 p-4 rounded-[32px] border border-slate-800/60 hover:border-slate-700 transition-all">
            {/* Image Placeholder or Image */}
            <div className="w-20 h-20 bg-slate-700 rounded-[24px] flex-shrink-0 overflow-hidden flex items-center justify-center">
                {product.image_url ? (
                    <img src={product.image_url} alt={productName} className="w-full h-full object-cover" />
                ) : (
                    <span className="text-2xl font-black text-slate-600 uppercase tracking-tighter italic">
                        {productName.substring(0, 2)}
                    </span>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <h4 className="font-black uppercase tracking-tight text-sm truncate leading-tight">
                    {productName}
                </h4>
                <p className="text-emerald-500 font-black italic tracking-tighter text-lg">
                    {formatPrice(Number(product.price))}
                </p>
                {product.modifier_groups.length > 0 && (
                    <button
                        onClick={onOpenModifiers}
                        className="mt-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300"
                    >
                        <Info className="w-3 h-3" />
                        Ver Modificadores
                    </button>
                )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
                {quantity > 0 && (
                    <>
                        <button
                            onClick={onRemove}
                            className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center active:scale-90 transition-transform"
                        >
                            <Minus className="w-5 h-5" />
                        </button>
                        <span className="text-xl font-black italic tracking-tighter min-w-[20px] text-center">
                            {quantity}
                        </span>
                    </>
                )}
                <button
                    onClick={product.modifier_groups.length > 0 && quantity === 0 ? onOpenModifiers : onAdd}
                    className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-lg",
                        quantity > 0 ? "bg-emerald-500 text-slate-900" : "bg-slate-700 text-white"
                    )}
                >
                    <Plus className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
}
