'use client';

import { useState } from 'react';
import { Product, ModifierGroup, SelectedModifier } from '@/types';
import { useExoCartStore } from '@/store/exo-cart-store';
import ProductListItem from './ProductListItem';
import ModifierModal from './ModifierModal';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';

interface Category {
    id: string;
    name: string;
}

interface QuickOrderMenuProps {
    categories: Category[];
    products: Product[];
}

export default function QuickOrderMenu({ categories, products }: QuickOrderMenuProps) {
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>(categories[0]?.id || '');
    const [searchTerm, setSearchTerm] = useState('');
    const [modifierProduct, setModifierProduct] = useState<Product | null>(null);

    const { items, addToCart, updateQuantity } = useExoCartStore();

    const filteredProducts = products.filter(p => {
        const matchesCategory = p.category_id === selectedCategoryId || selectedCategoryId === 'all';
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const getProductQuantity = (productId: string) => {
        return items
            .filter(item => item.product.id === productId)
            .reduce((total, item) => total + item.quantity, 0);
    };

    const handleAddProduct = (product: Product) => {
        if (product.modifier_groups.length > 0) {
            setModifierProduct(product);
        } else {
            addToCart(product, [], 1);
        }
    };

    const handleRemoveProduct = (productId: string) => {
        // Find the last added item of this product to remove
        const itemToRemove = [...items].reverse().find(item => item.product.id === productId);
        if (itemToRemove) {
            updateQuantity(itemToRemove.uniqueId, -1);
        }
    };

    const onModifierConfirm = (selectedModifiers: SelectedModifier[]) => {
        if (modifierProduct) {
            addToCart(modifierProduct, selectedModifiers, 1);
            setModifierProduct(null);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                    type="text"
                    placeholder="¿Qué desea el cliente?..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-800 border-none rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
            </div>

            {/* Categories Scroll */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <button
                    onClick={() => setSelectedCategoryId('all')}
                    className={cn(
                        "px-6 py-3 rounded-full font-black uppercase tracking-widest text-[10px] whitespace-nowrap border-2 transition-all",
                        selectedCategoryId === 'all'
                            ? "bg-emerald-500 border-emerald-500 text-slate-900"
                            : "bg-slate-800 border-slate-700 text-slate-400"
                    )}
                >
                    Todo
                </button>
                {categories.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedCategoryId(cat.id)}
                        className={cn(
                            "px-6 py-3 rounded-full font-black uppercase tracking-widest text-[10px] whitespace-nowrap border-2 transition-all",
                            selectedCategoryId === cat.id
                                ? "bg-emerald-500 border-emerald-500 text-slate-900"
                                : "bg-slate-800 border-slate-700 text-slate-400"
                        )}
                    >
                        {cat.name}
                    </button>
                ))}
            </div>

            {/* Product List */}
            <div className="space-y-3">
                {filteredProducts.map((product) => (
                    <ProductListItem
                        key={product.id}
                        product={product}
                        quantity={getProductQuantity(product.id)}
                        onAdd={() => handleAddProduct(product)}
                        onRemove={() => handleRemoveProduct(product.id)}
                        onOpenModifiers={() => setModifierProduct(product)}
                    />
                ))}

                {filteredProducts.length === 0 && (
                    <div className="text-center py-20 bg-slate-800/20 rounded-[32px] border-2 border-dashed border-slate-800">
                        <p className="text-slate-500 font-black uppercase tracking-widest text-xs italic">
                            No se encontraron productos
                        </p>
                    </div>
                )}
            </div>

            {/* Modals */}
            {modifierProduct && (
                <ModifierModal
                    product={modifierProduct}
                    onClose={() => setModifierProduct(null)}
                    onConfirm={onModifierConfirm}
                />
            )}
        </div>
    );
}
