'use client';

import { useState } from 'react';
import { Product, ModifierGroup, SelectedModifier, Modifier } from '@/types';
import { X, Check, Plus, Minus, ChefHat, MessageSquareText } from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface ModifierModalProps {
    product: Product;
    onClose: () => void;
    onConfirm: (selectedModifiers: SelectedModifier[], removedIngredients?: { id: string; name: string }[]) => void;
}

const DEFAULT_QUICK_INGREDIENTS = [
    'Cebolla',
    'Cilantro',
    'Salsa',
    'Picante',
    'Tomate',
    'Mayonesa',
    'Queso',
    'Sal'
];

const QUICK_KITCHEN_NOTES = [
    'Bien Cocido',
    'Término Medio',
    'Poco Picante',
    'Salsa Aparte',
    'Para Compartir',
    'Alergia'
];

export default function ModifierModal({ product, onClose, onConfirm }: ModifierModalProps) {
    const t = useTranslations('exo');
    const params = useParams();
    const locale = (params?.locale as string) || 'es';
    const productName = product.name?.[locale] || product.name?.es || (typeof product.name === 'string' ? product.name : '');

    // 1. Modifiers state
    const [selections, setSelections] = useState<SelectedModifier[]>(
        product.modifier_groups.map(group => ({
            groupId: group.id,
            groupName: group.name,
            options: []
        }))
    );

    // 2. Ingredients to remove state (set of ingredient names)
    // If product has configured removable_ingredients use them; otherwise use default quick ingredients
    const availableIngredients: string[] = (product.removable_ingredients && product.removable_ingredients.length > 0)
        ? product.removable_ingredients.map(i => i.name)
        : DEFAULT_QUICK_INGREDIENTS;

    const [removedIngredients, setRemovedIngredients] = useState<string[]>([]);

    // 3. Kitchen notes
    const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
    const [customNote, setCustomNote] = useState('');

    // 4. Quantity state
    const [quantity, setQuantity] = useState(1);

    const toggleRemovedIngredient = (ingName: string) => {
        setRemovedIngredients(prev =>
            prev.includes(ingName)
                ? prev.filter(name => name !== ingName)
                : [...prev, ingName]
        );
    };

    const toggleModifier = (group: ModifierGroup, modifier: Modifier) => {
        setSelections(prev => prev.map(sel => {
            if (sel.groupId === group.id) {
                const alreadySelected = sel.options.find(o => o.id === modifier.id);
                let newOptions = [...sel.options];

                if (alreadySelected) {
                    newOptions = newOptions.filter(o => o.id !== modifier.id);
                } else {
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

    const toggleKitchenNote = (note: string) => {
        setSelectedNotes(prev =>
            prev.includes(note)
                ? prev.filter(n => n !== note)
                : [...prev, note]
        );
    };

    const isGroupValid = (group: ModifierGroup) => {
        const selection = selections.find(s => s.groupId === group.id);
        const count = selection?.options.length || 0;
        if (group.is_required && count < group.min_selections) return false;
        return true;
    };

    const isAllValid = product.modifier_groups.every(isGroupValid);

    const calculateUnitTotal = () => {
        const base = Number(product.price);
        const mods = selections.reduce((total, sel) => {
            return total + sel.options.reduce((mTotal, opt) => mTotal + Number(opt.price), 0);
        }, 0);
        return base + mods;
    };

    const handleConfirm = () => {
        const finalModifiers = selections.filter(s => s.options.length > 0);

        // Append kitchen notes if any
        const allNotes = [...selectedNotes];
        if (customNote.trim()) {
            allNotes.push(customNote.trim());
        }

        if (allNotes.length > 0) {
            finalModifiers.push({
                groupId: 'kitchen-notes',
                groupName: t('kitchenNoteGroupName'),
                options: allNotes.map((noteText, idx) => ({
                    id: `note-${idx}`,
                    name: noteText,
                    price: 0,
                    is_available: true
                }))
            });
        }

        const formattedRemoved = removedIngredients.map(name => ({
            id: name,
            name: name
        }));

        onConfirm(finalModifiers, formattedRemoved);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-slate-900 rounded-t-[36px] sm:rounded-[36px] overflow-hidden flex flex-col max-h-[92vh] shadow-2xl border-x border-t sm:border border-slate-800 animate-in slide-in-from-bottom duration-300">

                {/* Header */}
                <div className="p-6 bg-slate-850 flex items-center justify-between border-b border-slate-800">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 w-fit mb-1">
                            {t('customizeDish')}
                        </span>
                        <h3 className="text-2xl font-black italic tracking-tighter uppercase leading-none text-white">
                            {productName}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full transition-colors active:scale-90"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-7 custom-scrollbar">

                    {/* SECCIÓN 1: QUITAR INGREDIENTES DE BASE */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">
                                    {t('removeIngredientsTitle')}
                                </h4>
                            </div>
                            {removedIngredients.length > 0 && (
                                <span className="text-[10px] font-black uppercase tracking-wider text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20">
                                    {t('removedCount', { count: removedIngredients.length })}
                                </span>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {availableIngredients.map((ing) => {
                                const isRemoved = removedIngredients.includes(ing);
                                return (
                                    <button
                                        key={ing}
                                        type="button"
                                        onClick={() => toggleRemovedIngredient(ing)}
                                        className={cn(
                                            "px-4 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all duration-200 flex items-center gap-2 border active:scale-95",
                                            isRemoved
                                                ? "bg-red-500/15 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)] line-through"
                                                : "bg-slate-800/80 border-slate-700/80 text-slate-300 hover:border-slate-500 hover:text-white"
                                        )}
                                    >
                                        <span className={cn(
                                            "w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black",
                                            isRemoved ? "bg-red-500 text-slate-900" : "bg-slate-700 text-emerald-400"
                                        )}>
                                            {isRemoved ? '✕' : '✓'}
                                        </span>
                                        <span>{isRemoved ? t('without', { name: ing }) : ing}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* SECCIÓN 2: GRUPOS DE MODIFICADORES Y EXTRAS */}
                    {product.modifier_groups.map((group) => (
                        <div key={group.id} className="space-y-3 pt-2 border-t border-slate-800/60">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">
                                    {group.name}
                                    {group.is_required && <span className="text-orange-500 ml-1">*</span>}
                                </h4>
                                <div className={cn(
                                    "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest",
                                    isGroupValid(group) ? "bg-emerald-500/10 text-emerald-400" : "bg-orange-500/10 text-orange-400"
                                )}>
                                    {group.is_required ? t('minRequired', { count: group.min_selections }) : t('optional')}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                                {group.options.map((option) => {
                                    const isSelected = selections.find(s => s.groupId === group.id)?.options.some(o => o.id === option.id);
                                    return (
                                        <button
                                            key={option.id}
                                            type="button"
                                            onClick={() => toggleModifier(group, option)}
                                            className={cn(
                                                "flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 active:scale-98",
                                                isSelected
                                                    ? "border-emerald-500 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                                    : "border-slate-800 bg-slate-800/40 hover:border-slate-700 text-slate-300"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-5 h-5 rounded-lg flex items-center justify-center transition-colors",
                                                    isSelected ? "bg-emerald-500 text-slate-900" : "bg-slate-700"
                                                )}>
                                                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[4px]" />}
                                                </div>
                                                <span className="font-bold text-xs tracking-tight uppercase">{option.name}</span>
                                            </div>
                                            {Number(option.price) > 0 && (
                                                <span className="font-black text-xs text-emerald-400">
                                                    +{formatPrice(Number(option.price), locale === 'es' ? 'es-SV' : 'en-US')}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* SECCIÓN 3: NOTAS RÁPIDAS PARA COCINA */}
                    <div className="space-y-3 pt-2 border-t border-slate-800/60">
                        <div className="flex items-center gap-2">
                            <ChefHat className="w-4 h-4 text-emerald-400" />
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">
                                {t('quickKitchenNotes')}
                            </h4>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {QUICK_KITCHEN_NOTES.map((note) => {
                                const isNoteSelected = selectedNotes.includes(note);
                                return (
                                    <button
                                        key={note}
                                        type="button"
                                        onClick={() => toggleKitchenNote(note)}
                                        className={cn(
                                            "px-3.5 py-2 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all border active:scale-95",
                                            isNoteSelected
                                                ? "bg-amber-500/15 border-amber-500 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                                                : "bg-slate-800/60 border-slate-750 text-slate-400 hover:text-slate-200 hover:border-slate-600"
                                        )}
                                    >
                                        {note}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="relative mt-2">
                            <input
                                type="text"
                                placeholder={t('customNotePlaceholder')}
                                value={customNote}
                                onChange={(e) => setCustomNote(e.target.value)}
                                className="w-full bg-slate-800/90 border border-slate-700/80 rounded-2xl py-3 px-4 text-xs text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Fijo */}
                <div className="p-5 bg-slate-850/95 backdrop-blur-md border-t border-slate-800 flex items-center gap-4">
                    {/* Selector de Cantidad */}
                    <div className="flex items-center bg-slate-800 border border-slate-700 rounded-2xl p-1 gap-2">
                        <button
                            type="button"
                            onClick={() => setQuantity(q => Math.max(1, q - 1))}
                            className="w-9 h-9 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-white flex items-center justify-center transition-all active:scale-90"
                        >
                            <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-black text-white text-base min-w-[20px] text-center">
                            {quantity}
                        </span>
                        <button
                            type="button"
                            onClick={() => setQuantity(q => q + 1)}
                            className="w-9 h-9 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-white flex items-center justify-center transition-all active:scale-90"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Botón Confirmar */}
                    <button
                        disabled={!isAllValid}
                        onClick={handleConfirm}
                        className={cn(
                            "flex-1 py-4.5 rounded-2xl flex items-center justify-between px-6 transition-all duration-300 active:scale-95 shadow-lg",
                            isAllValid
                                ? "bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow-[0_8px_25px_rgba(16,185,129,0.35)]"
                                : "bg-slate-800 text-slate-500 grayscale cursor-not-allowed border border-slate-700"
                        )}
                    >
                        <span className="text-base font-black uppercase italic tracking-tighter">
                            {t('addToOrder')}
                        </span>
                        <span className="text-xl font-black tracking-tighter italic">
                            {formatPrice(calculateUnitTotal() * quantity, locale === 'es' ? 'es-SV' : 'en-US')}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}
