'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { X, Check, Minus, Plus, ShoppingCart, Info, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn, formatPrice, getLocalizedValue } from '@/lib/utils';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Product, Modifier, ModifierGroup, SelectedModifier } from '@/types';
import { supabase } from '@/lib/supabase/client';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle, // Importante para accesibilidad
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';

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

interface ProductModalProps {
    product: Product;
    open: boolean;
    onClose: () => void;
    onAdd: (product: Product, selectedModifiers: SelectedModifier[], quantity: number, removedIngredients: { id: string; name: string }[]) => void;
    locale: string;
}

export function ProductModal({
    product,
    open,
    onClose,
    onAdd,
    locale
}: ProductModalProps) {
    const t = useTranslations('kiosk');

    // --- STATES ---
    const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
    const [quantity, setQuantity] = useState(1);

    // Removable Ingredients
    const [ingredients, setIngredients] = useState<any[]>([]);
    const [removedIngredients, setRemovedIngredients] = useState<string[]>([]);

    // UI Feedback for errors (e.g., trying to select more than max)
    const [errorGroup, setErrorGroup] = useState<string | null>(null);

    // --- EFFECTS ---

    // 1. Fetch Ingredients (Removable - with Exo Server fallback parity)
    useEffect(() => {
        if (open && product.id) {
            const fetchIngredients = async () => {
                try {
                    const { data } = await supabase
                        .from('product_ingredients')
                        .select('*, ingredients(id, name)')
                        .eq('product_id', product.id)
                        .eq('is_removable', true);

                    if (data && data.length > 0) {
                        const formattedIngredients = data.map((pi: any) => ({
                            id: pi.ingredient_id || pi.ingredients?.id || pi.ingredients?.name,
                            name: pi.ingredients?.name || 'Ingrediente'
                        }));
                        setIngredients(formattedIngredients);
                    } else if (product.removable_ingredients && product.removable_ingredients.length > 0) {
                        setIngredients(product.removable_ingredients.map((ri: any) => ({
                            id: ri.id || ri.name,
                            name: ri.name
                        })));
                    } else {
                        // Respaldo de ingredientes rápidos predeterminados idéntico a Exo Server
                        setIngredients(DEFAULT_QUICK_INGREDIENTS.map(name => ({
                            id: name,
                            name: name
                        })));
                    }
                } catch (err) {
                    console.error('Error fetching removable ingredients:', err);
                    setIngredients(DEFAULT_QUICK_INGREDIENTS.map(name => ({
                        id: name,
                        name: name
                    })));
                }
            };
            fetchIngredients();
            setRemovedIngredients([]);
            setQuantity(1);
            setErrorGroup(null);
        }
    }, [open, product.id, product.removable_ingredients]);

    // 2. Initialize Modifiers State
    useEffect(() => {
        if (open && product.modifier_groups) {
            const initialState: Record<string, string[]> = {};
            product.modifier_groups.forEach(group => {
                initialState[group.id] = [];
            });
            setSelectedModifiers(initialState);
        }
    }, [open, product]);

    // --- HANDLERS ---

    const toggleIngredient = (ingredientId: string) => {
        setRemovedIngredients(prev =>
            prev.includes(ingredientId)
                ? prev.filter(id => id !== ingredientId)
                : [...prev, ingredientId]
        );
    };

    const handleRadioChange = (groupId: string, modifierId: string) => {
        setSelectedModifiers(prev => ({
            ...prev,
            [groupId]: [modifierId]
        }));
        if (errorGroup === groupId) setErrorGroup(null);
    };

    const handleCheckboxChange = (groupId: string, modifierId: string, checked: boolean) => {
        setSelectedModifiers(prev => {
            const currentSelected = prev[groupId] || [];
            if (checked) {
                // Check Max Limit
                const group = product.modifier_groups?.find(g => g.id === groupId);
                if (group?.max_selections && currentSelected.length >= group.max_selections) {
                    // Trigger Error Feedback
                    setErrorGroup(groupId);
                    setTimeout(() => setErrorGroup(null), 2000);
                    return prev;
                }
                return { ...prev, [groupId]: [...currentSelected, modifierId] };
            } else {
                return { ...prev, [groupId]: currentSelected.filter(id => id !== modifierId) };
            }
        });
        if (errorGroup === groupId) setErrorGroup(null);
    };

    // --- CALCULATIONS ---

    const unitPrice = useMemo(() => {
        let total = Number(product.price);
        Object.entries(selectedModifiers).forEach(([groupId, modifierIds]) => {
            const group = product.modifier_groups?.find(g => g.id === groupId);
            if (group) {
                modifierIds.forEach(modId => {
                    const modifier = group.options.find(m => m.id === modId);
                    if (modifier) {
                        total += Number(modifier.price);
                    }
                });
            }
        });
        return total;
    }, [product, selectedModifiers]);

    const finalPrice = unitPrice * quantity;

    const isGroupValid = (group: ModifierGroup) => {
        const selections = selectedModifiers[group.id] || [];
        return selections.length >= group.min_selections;
    };

    const isFormValid = useMemo(() => {
        return product.modifier_groups?.every(group => isGroupValid(group)) ?? true;
    }, [product, selectedModifiers]);

    // --- SUBMIT ---

    const handleSubmit = () => {
        const mappedModifiers: SelectedModifier[] = [];

        Object.entries(selectedModifiers).forEach(([groupId, modifierIds]) => {
            const group = product.modifier_groups?.find(g => g.id === groupId);
            if (group && modifierIds.length > 0) {
                const selectedOptions = modifierIds.map(modId => {
                    const modifier = group.options.find(m => m.id === modId);
                    return modifier!;
                }).filter(Boolean);

                if (selectedOptions.length > 0) {
                    mappedModifiers.push({
                        groupId: group.id,
                        groupName: group.name,
                        options: selectedOptions
                    });
                }
            }
        });

        const removedIngredientsList = removedIngredients.map(id => {
            const ing = ingredients.find(i => i.id === id);
            return { id: id, name: ing ? ing.name : 'Unknown Ingredient' };
        });

        // Pass 'quantity' too! (Note: original prop might not have quantity, but we update logic)
        onAdd(product, mappedModifiers, quantity, removedIngredientsList);
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-3xl w-full h-[90vh] md:h-auto md:max-h-[90vh] p-0 gap-0 overflow-hidden bg-white border-none shadow-2xl sm:rounded-[2.5rem] flex flex-col">

                {/* 1. Header Sticky */}
                <div className="relative h-64 shrink-0">
                    {product.image_url ? (
                        <Image
                            src={product.image_url}
                            alt={getLocalizedValue(product.name, locale)}
                            fill
                            className="object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                            <ShoppingCart className="w-20 h-20 text-slate-400" />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full backdrop-blur-md transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    <div className="absolute bottom-6 left-6 right-6 text-white">
                        <DialogTitle className="text-3xl md:text-4xl font-black tracking-tight leading-none mb-2 drop-shadow-lg">
                            {getLocalizedValue(product.name, locale)}
                        </DialogTitle>
                        <p className="text-white/90 text-sm md:text-base font-medium line-clamp-2 max-w-xl drop-shadow-md">
                            {getLocalizedValue(product.description, locale)}
                        </p>
                        <div className="mt-3 inline-flex bg-white/20 backdrop-blur-md px-3 py-1 rounded-lg">
                            <span className="font-bold text-lg">
                                {formatPrice(Number(product.price), locale === 'es' ? 'es-SV' : 'en-US')}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 2. Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10 bg-slate-50 space-y-10 custom-scrollbar">

                    {/* Removable Ingredients */}
                    {ingredients.length > 0 && (
                        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                                    <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">
                                        {t('removeIngredientsTitle')}
                                    </h3>
                                </div>
                                {removedIngredients.length > 0 ? (
                                    <span className="text-[11px] font-black uppercase tracking-wider text-red-500 bg-red-100 px-3 py-1 rounded-full border border-red-200 animate-in zoom-in-50">
                                        {t('removedCount', { count: removedIngredients.length })}
                                    </span>
                                ) : (
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        {t('optional')}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 font-medium">
                                {t('customizeDesc', { product: getLocalizedValue(product.name, locale) })}
                            </p>

                            <div className="flex flex-wrap gap-2.5 pt-1">
                                {ingredients.map((ing) => {
                                    const isRemoved = removedIngredients.includes(ing.id);
                                    return (
                                        <button
                                            key={ing.id}
                                            type="button"
                                            onClick={() => toggleIngredient(ing.id)}
                                            className={cn(
                                                "px-4 py-3 rounded-2xl font-black text-sm uppercase tracking-wider transition-all duration-200 flex items-center gap-2.5 border active:scale-95 shadow-sm touch-target",
                                                isRemoved
                                                    ? "bg-red-50 border-red-400 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)] line-through"
                                                    : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-white"
                                            )}
                                        >
                                            <span className={cn(
                                                "w-5 h-5 rounded-full flex items-center justify-center text-xs font-black shrink-0 transition-colors",
                                                isRemoved ? "bg-red-500 text-white" : "bg-emerald-500 text-white"
                                            )}>
                                                {isRemoved ? '✕' : '✓'}
                                            </span>
                                            <span>{isRemoved ? t('without', { name: ing.name }) : ing.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Modifiers Groups */}
                    {product.modifier_groups?.map((group, idx) => {
                        const isRequired = group.is_required;
                        const groupValid = isGroupValid(group);
                        const selections = selectedModifiers[group.id] || [];
                        const hasError = errorGroup === group.id;

                        return (
                            <div
                                key={group.id}
                                className={`space-y-4 animate-in slide-in-from-bottom-8 duration-700 fill-mode-backwards`}
                                style={{ animationDelay: `${idx * 100}ms` }}
                            >
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <h3 className={`text-xl font-black uppercase italic tracking-tight transition-colors ${hasError ? 'text-red-500' : 'text-slate-900'}`}>
                                            {group.name} {hasError && "(!)"}
                                        </h3>

                                        {isRequired ? (
                                            <span className={`text-[10px] px-2 py-1 rounded-lg font-black uppercase tracking-widest transition-colors ${groupValid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {groupValid ? 'Completado' : `${t('required')} (Min ${group.min_selections})`}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] px-2 py-1 rounded-lg font-black uppercase tracking-widest bg-slate-100 text-slate-400">
                                                {t('optional')} {group.max_selections && `(Max ${group.max_selections})`}
                                            </span>
                                        )}
                                    </div>
                                    {hasError && (
                                        <p className="text-xs font-bold text-red-500 animate-pulse">
                                            ⚠️ Máximo {group.max_selections} selecciones permitidas
                                        </p>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {group.options.filter(m => m.is_available).map((modifier) => {
                                        const isSelected = selections.includes(modifier.id);
                                        const isSingleChoice = group.max_selections === 1;

                                        return (
                                            <div
                                                key={modifier.id}
                                                onClick={() => isSingleChoice
                                                    ? handleRadioChange(group.id, modifier.id)
                                                    : handleCheckboxChange(group.id, modifier.id, !isSelected)
                                                }
                                                className={`
                                                    relative flex items-center justify-between p-4 min-h-[4rem] rounded-2xl border-2 transition-all duration-200 cursor-pointer active:scale-[0.98] select-none
                                                    ${isSelected
                                                        ? 'bg-primary-50 border-primary-500 shadow-[0_0_0_1px_rgba(249,115,22,1)] z-10'
                                                        : 'bg-white border-slate-200 hover:border-primary-300 hover:shadow-md'
                                                    }
                                                `}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`
                                                        w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors shrink-0
                                                        ${isSelected
                                                            ? 'border-primary-500 bg-primary-500'
                                                            : 'border-slate-300 bg-slate-50'
                                                        }
                                                    `}>
                                                        {isSelected && <Check className="w-3 h-3 text-white stroke-[4]" />}
                                                    </div>
                                                    <span className={`font-bold text-base leading-tight ${isSelected ? 'text-primary-900' : 'text-slate-700'}`}>
                                                        {modifier.name}
                                                    </span>
                                                </div>

                                                {Number(modifier.price) > 0 && (
                                                    <span className="text-sm font-black text-primary-600 bg-primary-50 px-2 py-1 rounded-lg">
                                                        +{formatPrice(Number(modifier.price), locale === 'es' ? 'es-SV' : 'en-US')}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    {/* Padding bottom so content isn't hidden by sticky footer */}
                    <div className="h-24" />
                </div>

                {/* 3. Sticky Footer */}
                <DialogFooter className="sticky bottom-0 z-20 bg-white/80 backdrop-blur-xl border-t border-slate-200 p-4 shrink-0 sm:p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
                    <div className="w-full flex flex-col sm:flex-row items-center gap-4">

                        {/* Quantity Selector */}
                        <div className="flex items-center bg-slate-100 rounded-full p-1 w-full sm:w-auto shrink-0 shadow-inner">
                            <button
                                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                className="w-12 h-12 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                                disabled={quantity <= 1}
                            >
                                <Minus className="w-5 h-5 stroke-[3]" />
                            </button>
                            <span className="w-12 text-center text-xl font-black text-slate-900 tabular-nums">
                                {quantity}
                            </span>
                            <button
                                onClick={() => setQuantity(q => q + 1)}
                                className="w-12 h-12 rounded-full bg-primary-500 text-white flex items-center justify-center shadow-lg shadow-primary-500/30 hover:scale-105 active:scale-95 transition-all"
                            >
                                <Plus className="w-5 h-5 stroke-[3]" />
                            </button>
                        </div>

                        {/* Add Button */}
                        <Button
                            disabled={!isFormValid}
                            onClick={handleSubmit}
                            className={`
                                flex-1 h-16 w-full rounded-[2rem] text-xl font-black uppercase tracking-widest transition-all duration-300 relative overflow-hidden group
                                ${isFormValid
                                    ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-xl shadow-slate-900/20 hover:-translate-y-1'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }
                            `}
                        >
                            <span className="relative z-10 flex items-center justify-center gap-3">
                                {isFormValid ? (
                                    <>
                                        <span>{t('addToOrder')}</span>
                                        <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                                        <span>{formatPrice(finalPrice, locale === 'es' ? 'es-SV' : 'en-US')}</span>
                                    </>
                                ) : (
                                    <span className="text-sm">{t('completeSelection')}</span>
                                )}
                            </span>
                            {isFormValid && (
                                <div className="absolute inset-0 bg-gradient-to-r from-primary-500/0 via-white/20 to-primary-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
