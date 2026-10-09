'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { X, Check, Minus, Plus, ShoppingCart, Info, AlertCircle } from 'lucide-react';
import { formatPrice, getLocalizedValue } from '@/lib/utils';
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
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';

interface ProductCustomizationModalProps {
    product: Product;
    open: boolean;
    onClose: () => void;
    onAdd: (product: Product, selectedModifiers: SelectedModifier[], totalPrice: number, removedIngredients: { id: string; name: string }[]) => void;
    locale: string;
}

export function ProductCustomizationModal({
    product,
    open,
    onClose,
    onAdd,
    locale
}: ProductCustomizationModalProps) {
    const t = useTranslations('kiosk');

    // State to store selected modifiers per group
    const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});

    // State for removable ingredients
    const [ingredients, setIngredients] = useState<any[]>([]);
    const [removedIngredients, setRemovedIngredients] = useState<string[]>([]);

    useEffect(() => {
        if (open && product.id) {
            const fetchIngredients = async () => {
                const { data } = await supabase
                    .from('product_ingredients')
                    .select('*, ingredients(id, name)')
                    .eq('product_id', product.id)
                    .eq('is_removable', true); // Only fetch removable ones

                if (data) {
                    const formattedIngredients = data.map((pi: any) => ({
                        id: pi.ingredient_id,
                        name: pi.ingredients.name // Access joined data
                    }));
                    setIngredients(formattedIngredients);
                }
            };
            fetchIngredients();
            setRemovedIngredients([]); // Reset on open
        }
    }, [open, product.id]);

    const toggleIngredient = (ingredientId: string) => {
        setRemovedIngredients(prev =>
            prev.includes(ingredientId)
                ? prev.filter(id => id !== ingredientId)
                : [...prev, ingredientId]
        );
    };

    // Initialize state with default values if any
    useEffect(() => {
        if (open && product.modifier_groups) {
            const initialState: Record<string, string[]> = {};
            product.modifier_groups.forEach(group => {
                initialState[group.id] = [];
            });
            setSelectedModifiers(initialState);
        }
    }, [open, product]);

    // Handle selection for Radio Groups (max_selections === 1)
    const handleRadioChange = (groupId: string, modifierId: string) => {
        setSelectedModifiers(prev => ({
            ...prev,
            [groupId]: [modifierId]
        }));
    };

    // Handle selection for Checkboxes (max_selections > 1 or null)
    const handleCheckboxChange = (groupId: string, modifierId: string, checked: boolean) => {
        setSelectedModifiers(prev => {
            const currentSelected = prev[groupId] || [];
            if (checked) {
                // Check if we can add more (max_selections)
                const group = product.modifier_groups?.find(g => g.id === groupId);
                if (group?.max_selections && currentSelected.length >= group.max_selections) {
                    return prev; // Don't add if limit reached
                }
                return {
                    ...prev,
                    [groupId]: [...currentSelected, modifierId]
                };
            } else {
                return {
                    ...prev,
                    [groupId]: currentSelected.filter(id => id !== modifierId)
                };
            }
        });
    };

    // Calculate total price in real-time
    const totalPrice = useMemo(() => {
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

    // Check if a group is valid (meets min_selections)
    const isGroupValid = (group: ModifierGroup) => {
        const selections = selectedModifiers[group.id] || [];
        return selections.length >= group.min_selections;
    };

    // Overall form validity
    const isFormValid = useMemo(() => {
        return product.modifier_groups?.every(group => isGroupValid(group)) ?? true;
    }, [product, selectedModifiers]);

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

        onAdd(product, mappedModifiers, totalPrice, removedIngredientsList);
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white border-none shadow-2xl sm:rounded-[3rem] animate-scale-in">
                {/* Header with Background Image / Gradient */}
                <div className="relative h-48 sm:h-64 overflow-hidden">
                    {product.image_url ? (
                        <Image
                            src={product.image_url}
                            alt={getLocalizedValue(product.name, locale)}
                            fill
                            className="object-cover transition-transform duration-700 hover:scale-110"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                            <ShoppingCart className="w-20 h-20 text-white/30 animate-pulse" />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                    <div className="absolute bottom-6 left-8 right-8">
                        <DialogTitle className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2">
                            {getLocalizedValue(product.name, locale)}
                        </DialogTitle>
                        {(product.description?.es || typeof product.description === 'string' || product.description) && (
                            <p className="text-white/80 text-sm sm:text-base font-medium line-clamp-2 max-w-lg">
                                {getLocalizedValue(product.description, locale)}
                            </p>
                        )}
                        <p className="text-white font-bold text-xl mt-2">
                            {t('price')}: {formatPrice(Number(product.price), locale === 'es' ? 'es-SV' : 'en-US')}
                        </p>
                    </div>
                </div>

                {/* Content - Modifier Groups */}
                <div className="p-6 sm:p-10 max-h-[50vh] overflow-y-auto custom-scrollbar bg-secondary-50/30">
                    <div className="space-y-10">
                        {/* Removable Ingredients Section */}
                        {ingredients.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-xl font-black text-secondary-900 flex items-center gap-2">
                                    {t('customizeTitle')}
                                </h3>
                                <p className="text-xs font-bold text-secondary-400 uppercase tracking-widest mt-1">
                                    {t('customizeDesc', { product: getLocalizedValue(product.name, locale) })}
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {ingredients.map((ing) => {
                                        const isRemoved = removedIngredients.includes(ing.id);
                                        return (
                                            <div
                                                key={ing.id}
                                                className={`
                                                    relative flex items-center space-x-3 p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer
                                                    ${isRemoved
                                                        ? 'bg-red-50 border-red-500/50 shadow-sm'
                                                        : 'bg-white border-secondary-100 hover:border-secondary-200'
                                                    }
                                                `}
                                                onClick={() => toggleIngredient(ing.id)}
                                            >
                                                <Checkbox
                                                    id={`ing-${ing.id}`}
                                                    checked={!isRemoved} // Logic inverted: checked means INCLUDED
                                                    className="data-[state=checked]:bg-primary-500 data-[state=checked]:border-primary-500 pointer-events-none"
                                                />
                                                <div className="flex-1">
                                                    <Label
                                                        htmlFor={`ing-${ing.id}`}
                                                        className={`text-base font-bold cursor-pointer block ${isRemoved ? 'text-red-500 line-through' : 'text-secondary-900'}`}
                                                    >
                                                        {ing.name}
                                                    </Label>
                                                    <span className={`text-[10px] uppercase font-black tracking-wider ${isRemoved ? 'text-red-500' : 'text-primary-600'}`}>
                                                        {isRemoved ? t('removed') : t('included')}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {product.modifier_groups?.map((group) => {
                            const isRequired = group.required;
                            const groupValid = isGroupValid(group);
                            const selections = selectedModifiers[group.id] || [];

                            return (
                                <div key={group.id} className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-xl font-black text-secondary-900 flex items-center gap-2">
                                                {group.name}
                                                {group.max_selections && (
                                                    <span className="text-sm font-bold text-secondary-400">
                                                        ({selections.length}/{group.max_selections})
                                                    </span>
                                                )}
                                                {isRequired && (
                                                    <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full font-bold ${groupValid ? 'bg-accent-100 text-accent-700' : 'bg-red-100 text-red-600 animate-pulse'}`}>
                                                        {groupValid ? '✓' : t('required')}
                                                    </span>
                                                )}
                                            </h3>
                                            <p className="text-xs font-bold text-secondary-400 uppercase tracking-widest mt-1">
                                                {group.min_selections > 0 && `${t('min')}: ${group.min_selections}`}
                                                {!group.max_selections && group.min_selections === 0 && t('optional')}
                                            </p>
                                        </div>
                                    </div>

                                    {group.max_selections === 1 ? (
                                        <RadioGroup
                                            value={selections[0]}
                                            onValueChange={(val) => handleRadioChange(group.id, val)}
                                            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                                        >
                                            {group.options.filter(m => m.is_available).map((modifier) => (
                                                <div
                                                    key={modifier.id}
                                                    className={`
                                                        relative flex items-center space-x-3 p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer
                                                        ${selections.includes(modifier.id)
                                                            ? 'bg-primary-50 border-primary-500 shadow-md ring-2 ring-primary-500/20'
                                                            : 'bg-white border-secondary-100 hover:border-secondary-200 hover:bg-secondary-50/50'
                                                        }
                                                    `}
                                                    onClick={() => handleRadioChange(group.id, modifier.id)}
                                                >
                                                    <RadioGroupItem value={modifier.id} id={modifier.id} className="sr-only" />
                                                    <div className="flex-1">
                                                        <Label
                                                            htmlFor={modifier.id}
                                                            className="text-base font-bold text-secondary-900 cursor-pointer block"
                                                        >
                                                            {modifier.name}
                                                        </Label>
                                                        {modifier.price > 0 && (
                                                            <span className="text-sm font-black text-primary-600">
                                                                + {formatPrice(modifier.price, locale === 'es' ? 'es-SV' : 'en-US')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {selections.includes(modifier.id) && (
                                                        <div className="bg-primary-500 text-white rounded-full p-1">
                                                            <Check className="w-4 h-4 stroke-[3]" />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </RadioGroup>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {group.options.filter(m => m.is_available).map((modifier) => {
                                                const isChecked = selections.includes(modifier.id);
                                                const canSelectMore = !group.max_selections || selections.length < group.max_selections;
                                                const isDisabled = !isChecked && !canSelectMore;

                                                return (
                                                    <div
                                                        key={modifier.id}
                                                        className={`
                                                            relative flex items-center space-x-3 p-4 rounded-2xl border-2 transition-all duration-200
                                                            ${isChecked
                                                                ? 'bg-primary-50 border-primary-500 shadow-md ring-2 ring-primary-500/20'
                                                                : 'bg-white border-secondary-100 hover:border-secondary-200 hover:bg-secondary-50/50'
                                                            }
                                                            ${isDisabled ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-pointer'}
                                                        `}
                                                        onClick={() => !isDisabled && handleCheckboxChange(group.id, modifier.id, !isChecked)}
                                                    >
                                                        <Checkbox
                                                            id={modifier.id}
                                                            checked={isChecked}
                                                            onCheckedChange={(checked) => handleCheckboxChange(group.id, modifier.id, !!checked)}
                                                            className="sr-only"
                                                            disabled={isDisabled}
                                                        />
                                                        <div className="flex-1">
                                                            <Label
                                                                htmlFor={modifier.id}
                                                                className="text-base font-bold text-secondary-900 cursor-pointer block"
                                                            >
                                                                {modifier.name}
                                                            </Label>
                                                            {modifier.price > 0 && (
                                                                <span className="text-sm font-black text-primary-600">
                                                                    + {formatPrice(modifier.price, locale === 'es' ? 'es-SV' : 'en-US')}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {isChecked && (
                                                            <div className="bg-primary-500 text-white rounded-full p-1">
                                                                <Check className="w-4 h-4 stroke-[3]" />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer - Final Action */}
                <DialogFooter className="p-8 pb-10 sm:p-10 bg-white border-t border-secondary-100 mt-auto">
                    <Button
                        disabled={!isFormValid}
                        onClick={handleSubmit}
                        className={`
                            w-full h-16 sm:h-20 rounded-[2rem] text-xl sm:text-2xl font-black uppercase tracking-widest transition-all duration-500
                            ${isFormValid
                                ? 'bg-primary-500 hover:bg-primary-600 shadow-xl shadow-primary-200 hover:scale-[1.02] active:scale-95'
                                : 'bg-secondary-200 text-secondary-400 cursor-not-allowed'
                            }
                        `}
                    >
                        {isFormValid ? (
                            <div className="flex items-center justify-center gap-4">
                                <Plus className="w-6 h-6 sm:w-8 sm:h-8" />
                                <span>{t('addToCart')} — {formatPrice(totalPrice, locale === 'es' ? 'es-SV' : 'en-US')}</span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-3">
                                <AlertCircle className="w-6 h-6 animate-pulse" />
                                <span>{t('selectModifiers')}</span>
                            </div>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
