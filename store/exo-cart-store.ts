import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CartItem, Product, SelectedModifier } from '@/types';

interface ExoCartStore {
    tableId: string | null;
    waitressId: string | null;
    items: CartItem[];
    isOnline: boolean;
    isSupabaseConnected: boolean;
    pendingOrdersCount: number;

    setTableId: (id: string | null) => void;
    setWaitressId: (id: string | null) => void;
    setConnectivity: (isOnline: boolean, isSupabaseConnected: boolean) => void;

    addToCart: (product: Product, modifiers: SelectedModifier[], quantity: number) => void;
    removeFromCart: (uniqueId: string) => void;
    updateQuantity: (uniqueId: string, delta: number) => void;
    clearCart: () => void;

    getCartTotal: () => number;
    getCartCount: () => number;

    incrementPendingOrders: () => void;
    decrementPendingOrders: () => void;
}

export const useExoCartStore = create<ExoCartStore>()(
    persist(
        (set, get) => ({
            tableId: null,
            waitressId: null,
            items: [],
            isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
            isSupabaseConnected: true,
            pendingOrdersCount: 0,

            setTableId: (id) => set({ tableId: id }),
            setWaitressId: (id) => set({ waitressId: id }),
            setConnectivity: (isOnline, isSupabaseConnected) => set({ isOnline, isSupabaseConnected }),

            addToCart: (product, modifiers, quantity) => {
                const uniqueId = crypto.randomUUID();
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
                    }).filter(item => item.quantity > 0);

                    return { items: newItems };
                });
            },

            clearCart: () => set({ items: [] }),

            getCartTotal: () => {
                return get().items.reduce((total, item) => total + item.totalPrice, 0);
            },

            getCartCount: () => {
                return get().items.reduce((count, item) => count + item.quantity, 0);
            },

            incrementPendingOrders: () => set((state) => ({ pendingOrdersCount: state.pendingOrdersCount + 1 })),
            decrementPendingOrders: () => set((state) => ({ pendingOrdersCount: Math.max(0, state.pendingOrdersCount - 1) })),
        }),
        {
            name: 'exo-server-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                tableId: state.tableId,
                waitressId: state.waitressId,
                items: state.items,
            }),
        }
    )
);
