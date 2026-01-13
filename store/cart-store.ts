import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ModifierSelection {
    groupId: string;
    groupName: string;
    options: {
        id: string;
        name: string;
        priceAdjustment: number;
    }[];
}

export interface CartItem {
    id: string; // Unique cart item ID
    productId: string;
    productName: string;
    productPrice: number;
    productImage: string | null;
    quantity: number;
    modifiers: ModifierSelection[];
    removedIngredients: string[]; // Array of ingredient IDs
    totalPrice: number;
}

interface CartStore {
    items: CartItem[];
    addItem: (item: Omit<CartItem, 'id'>) => void;
    removeItem: (id: string) => void;
    updateQuantity: (id: string, quantity: number) => void;
    clearCart: () => void;
    getTotal: () => number;
    getItemCount: () => number;
}

export const useCartStore = create<CartStore>()(
    persist(
        (set, get) => ({
            items: [],

            addItem: (item) => {
                const id = `${item.productId}-${Date.now()}-${Math.random()}`;
                const modifiersTotal = item.modifiers.reduce(
                    (sum, group) =>
                        sum +
                        group.options.reduce(
                            (optSum, opt) => optSum + opt.priceAdjustment,
                            0
                        ),
                    0
                );
                const totalPrice = (item.productPrice + modifiersTotal) * item.quantity;

                set((state) => ({
                    items: [...state.items, { ...item, id, totalPrice }],
                }));
            },

            removeItem: (id) => {
                set((state) => ({
                    items: state.items.filter((item) => item.id !== id),
                }));
            },

            updateQuantity: (id, quantity) => {
                if (quantity <= 0) {
                    get().removeItem(id);
                    return;
                }

                set((state) => ({
                    items: state.items.map((item) => {
                        if (item.id === id) {
                            const modifiersTotal = item.modifiers.reduce(
                                (sum, group) =>
                                    sum +
                                    group.options.reduce(
                                        (optSum, opt) => optSum + opt.priceAdjustment,
                                        0
                                    ),
                                0
                            );
                            const totalPrice = (item.productPrice + modifiersTotal) * quantity;
                            return { ...item, quantity, totalPrice };
                        }
                        return item;
                    }),
                }));
            },

            clearCart: () => {
                set({ items: [] });
            },

            getTotal: () => {
                return get().items.reduce((sum, item) => sum + item.totalPrice, 0);
            },

            getItemCount: () => {
                return get().items.reduce((sum, item) => sum + item.quantity, 0);
            },
        }),
        {
            name: 'orderpoint-cart',
        }
    )
);
