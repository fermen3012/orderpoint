import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CartItem, Product, SelectedModifier } from '@/types';

interface CartStore {
    items: CartItem[];
    addToCart: (product: Product, modifiers: SelectedModifier[], quantity: number, removedIngredients?: { id: string; name: string }[]) => void;
    removeFromCart: (uniqueId: string) => void;
    updateQuantity: (uniqueId: string, delta: number) => void;
    clearCart: () => void;

    // Computed properties are derived from state in components usually, 
    // but we can provide helper functions or getters if needed.
    // Zustand doesn't have "computed" properties like Vue, but we can have selectors.
    getCartTotal: () => number;
    getCartCount: () => number;
}

export const useCartStore = create<CartStore>()(
    persist(
        (set, get) => ({
            items: [],

            addToCart: (product: Product, modifiers: SelectedModifier[], quantity: number, removedIngredients?: { id: string; name: string }[]) => {
                const uniqueId = crypto.randomUUID();

                // Calculate base price + modifiers
                const basePrice = Number(product.price);
                const modifiersTotal = modifiers.reduce((total, group) => {
                    return total + group.options.reduce((groupTotal, option) => {
                        return groupTotal + Number(option.price);
                    }, 0);
                }, 0);

                const unitPrice = basePrice + modifiersTotal;
                const totalPrice = unitPrice * quantity;

                const newItem: CartItem = {
                    uniqueId,
                    product,
                    selectedModifiers: modifiers,
                    quantity,
                    unitPrice,
                    totalPrice,
                    removedIngredients: removedIngredients || []
                };

                set((state) => ({
                    items: [...state.items, newItem]
                }));
            },

            removeFromCart: (uniqueId) => {
                set((state) => ({
                    items: state.items.filter((item) => item.uniqueId !== uniqueId)
                }));
            },

            updateQuantity: (uniqueId, delta) => {
                set((state) => {
                    const newItems = state.items.map((item) => {
                        if (item.uniqueId === uniqueId) {
                            const newQuantity = Math.max(0, item.quantity + delta);
                            return {
                                ...item,
                                quantity: newQuantity,
                                totalPrice: item.unitPrice * newQuantity
                            };
                        }
                        return item;
                    }).filter(item => item.quantity > 0); // Remove if quantity becomes 0

                    return { items: newItems };
                });
            },

            clearCart: () => {
                set({ items: [] });
            },

            getCartTotal: () => {
                return get().items.reduce((total, item) => total + item.totalPrice, 0);
            },

            getCartCount: () => {
                return get().items.reduce((count, item) => count + item.quantity, 0);
            }
        }),
        {
            name: 'orderpoint-cart-storage', // unique name
            storage: createJSONStorage(() => localStorage),
        }
    )
);
