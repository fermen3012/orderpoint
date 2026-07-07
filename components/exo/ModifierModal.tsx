'use client';

import { useState } from 'react';
import { Product, ModifierGroup, SelectedModifier, Modifier } from '@/types';
import { X, Check, Plus, Minus } from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';

import { useParams } from 'next/navigation';

interface ModifierModalProps {
    product: Product;
    onClose: () => void;
    onConfirm: (selectedModifiers: SelectedModifier[]) => void;
}

export default function ModifierModal({ product, onClose, onConfirm }: ModifierModalProps) {
    const params = useParams();
    const locale = (params?.locale as string) || 'es';
    const productName = product.name?.[locale] || product.name?.es || (typeof product.name === 'string' ? product.name : '');
    const [selections, setSelections] = useState<SelectedModifier[]>(
        product.modifier_groups.map(group => ({
            groupId: group.id,
            groupName: group.name,
            options: []
        }))
    );

    const toggleModifier = (group: ModifierGroup, modifier: Modifier) => {
        setSelections(prev => prev.map(sel => {
            if (sel.groupId === group.id) {
                const alreadySelected = sel.options.find(o => o.id === modifier.id);
                let newOptions = [...sel.options];

                if (alreadySelected) {
                    newOptions = newOptions.filter(o => o.id !== modifier.id);
                } else {
                    // Respect max_selections if it exists
                    if (group.max_selections === 1) {
                        newOptions = [modifier];
                    } else if (!group.max_selections || newOptions.length < group.max_selections) {
                        newOptions.push(modifier);
                    }
                }
                return { ...sel, options: newOptions };
            }
            return sel;
        }));
    };

    const isGroupValid = (group: ModifierGroup) => {
        const selection = selections.find(s => s.groupId === group.id);
        const count = selection?.options.length || 0;
        if (group.is_required && count < group.min_selections) return false;
        return true;
    };

    const isAllValid = product.modifier_groups.every(isGroupValid);

    const calculateTotal = () => {
        const base = Number(product.price);
        const mods = selections.reduce((total, sel) => {
            return total + sel.options.reduce((mTotal, opt) => mTotal + Number(opt.price), 0);
        }, 0);
        return base + mods;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-slate-900 rounded-t-[32px] sm:rounded-[32px] overflow-hidden flex flex-col max-h-[90vh] shadow-2xl border-x border-t sm:border border-slate-800 animate-in slide-in-from-bottom-full duration-500">

                {/* Header */}
                <div className="p-6 bg-slate-800/50 flex items-center justify-between border-b border-slate-700">
                    <div className="flex flex-col">
                        <h3 className="text-2xl font-black italic tracking-tighter uppercase leading-none">
                            {productName}
                        </h3>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                            Personaliza tu pedido
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-700 rounded-full hover:bg-slate-600 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {product.modifier_groups.map((group) => (
                        <div key={group.id} className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-lg font-black uppercase tracking-tight">
                                    {group.name}
                                    {group.is_required && <span className="text-orange-500 ml-1">*</span>}
                                </h4>
                                <div className={cn(
                                    "px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest",
                                    isGroupValid(group) ? "bg-emerald-500/10 text-emerald-500" : "bg-orange-500/10 text-orange-500"
                                )}>
                                    {group.is_required ? `Mín. ${group.min_selections}` : 'Opcional'}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                                {group.options.map((option) => {
                                    const isSelected = selections.find(s => s.groupId === group.id)?.options.find(o => o.id === option.id);
                                    return (
                                        <button
                                            key={option.id}
                                            onClick={() => toggleModifier(group, option)}
                                            className={cn(
                                                "flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-200",
                                                isSelected
                                                    ? "border-emerald-500 bg-emerald-500/10"
                                                    : "border-slate-800 bg-slate-800/30 hover:border-slate-700"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-5 h-5 rounded flex items-center justify-center transition-colors",
                                                    isSelected ? "bg-emerald-500" : "bg-slate-700"
                                                )}>
                                                    {isSelected && <Check className="w-3 h-3 text-slate-900 stroke-[4px]" />}
                                                </div>
                                                <span className="font-bold text-sm tracking-tight">{option.name}</span>
                                            </div>
                                            <span className="font-black text-xs text-slate-400">
                                                +{formatPrice(Number(option.price))}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-800/80 backdrop-blur-md border-t border-slate-700">
                    <button
                        disabled={!isAllValid}
                        onClick={() => onConfirm(selections.filter(s => s.options.length > 0))}
                        className={cn(
                            "w-full py-5 rounded-2xl flex items-center justify-between px-6 transition-all duration-300 active:scale-95",
                            isAllValid
                                ? "bg-emerald-500 text-slate-900 shadow-[0_4px_20px_rgba(16,185,129,0.3)]"
                                : "bg-slate-700 text-slate-500 grayscale cursor-not-allowed"
                        )}
                    >
                        <span className="text-xl font-black uppercase italic tracking-tighter">Confirmar</span>
                        <div className="flex items-center gap-2">
                            <span className="text-xs uppercase font-bold opacity-70">Total:</span>
                            <span className="text-2xl font-black tracking-tighter italic">
                                {formatPrice(calculateTotal())}
                            </span>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
