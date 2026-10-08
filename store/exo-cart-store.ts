import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CartItem, Product, SelectedModifier } from '@/types';
import { generateUUID } from '@/lib/utils';

interface ExoCartStore {
    tableId: string | null;
    waitressId: string | null;
    items: CartItem[];
    cartsByTable: Record<string, CartItem[]>;
    isOnline: boolean;
    isSupabaseConnected: boolean;
    pendingOrdersCount: number;

    setTableId: (id: string | null) => void;
    setWaitressId: (id: string | null) => void;
    setConnectivity: (isOnline: boolean, isSupabaseConnected: boolean) => void;

    addToCart: (product: Product, modifiers: SelectedModifier[], quantity: number, removedIngredients?: { id: string; name: string }[]) => void;
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
            cartsByTable: {},
            isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
            isSupabaseConnected: true,
            pendingOrdersCount: 0,

            setTableId: (id) => {
                set((state) => {
                    const activeKey = id || 'default';
                    const tableItems = state.cartsByTable[activeKey] || [];
                    return {
                        tableId: id,
                        items: tableItems,
                    };
                });
            },

            setWaitressId: (id) => set({ waitressId: id }),
            setConnectivity: (isOnline, isSupabaseConnected) => set({ isOnline, isSupabaseConnected }),

            addToCart: (product, modifiers, quantity, removedIngredients) => {
                const uniqueId = generateUUID();
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
                    removedIngredients: removedIngredients || [],
                };

                set((state) => {
                    const activeKey = state.tableId || 'default';
                    const currentItems = state.cartsByTable[activeKey] || [];
                    const updatedItems = [...currentItems, newItem];
                    return {
                        cartsByTable: {
                            ...state.cartsByTable,
                            [activeKey]: updatedItems,
                        },
                        items: updatedItems,
                    };
                });
            },

            removeFromCart: (uniqueId) => {
                set((state) => {
                    const activeKey = state.tableId || 'default';
                    const currentItems = state.cartsByTable[activeKey] || [];
                    const updatedItems = currentItems.filter((item) => item.uniqueId !== uniqueId);
                    return {
                        cartsByTable: {
                            ...state.cartsByTable,
                            [activeKey]: updatedItems,
                        },
                        items: updatedItems,
                    };
                });
            },

            updateQuantity: (uniqueId, delta) => {
                set((state) => {
                    const activeKey = state.tableId || 'default';
                    const currentItems = state.cartsByTable[activeKey] || [];
                    const updatedItems = currentItems.map((item) => {
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

                    return {
                        cartsByTable: {
                            ...state.cartsByTable,
                            [activeKey]: updatedItems,
                        },
                        items: updatedItems,
                    };
                });
            },

            clearCart: () => {
                set((state) => {
                    const activeKey = state.tableId || 'default';
                    const newCarts = { ...state.cartsByTable };
                    delete newCarts[activeKey];
                    return {
                        cartsByTable: newCarts,
                        items: [],
                    };
                });
            },

            getCartTotal: () => {
                const state = get();
                const activeKey = state.tableId || 'default';
                const currentItems = state.cartsByTable[activeKey] || state.items || [];
                return currentItems.reduce((total, item) => total + item.totalPrice, 0);
            },

            getCartCount: () => {
                const state = get();
                const activeKey = state.tableId || 'default';
                const currentItems = state.cartsByTable[activeKey] || state.items || [];
                return currentItems.reduce((count, item) => count + item.quantity, 0);
            },

            incrementPendingOrders: () => set((state) => ({ pendingOrdersCount: state.pendingOrdersCount + 1 })),
            decrementPendingOrders: () => set((state) => ({ pendingOrdersCount: Math.max(0, state.pendingOrdersCount - 1) })),
        }),
        {
            name: 'exo-server-storage',
            version: 2,
            storage: createJSONStorage(() => localStorage),
            migrate: (persistedState: any, version: number) => {
                if (version === 0 || !version || version < 2) {
                    const oldItems = Array.isArray(persistedState?.items) ? persistedState.items : [];
                    const oldTableId = persistedState?.tableId;
                    const cartsByTable: Record<string, CartItem[]> = persistedState?.cartsByTable || {};
                    if (oldItems.length > 0) {
                        const targetKey = oldTableId || 'default';
                        if (!cartsByTable[targetKey]) {
                            cartsByTable[targetKey] = oldItems;
                        }
                    }
                    const activeKey = oldTableId || 'default';
                    return {
                        ...persistedState,
                        cartsByTable,
                        items: cartsByTable[activeKey] || [],
                    };
                }
                return persistedState as any;
            },
            partialize: (state) => ({
                tableId: state.tableId,
                waitressId: state.waitressId,
                cartsByTable: state.cartsByTable,
                items: state.items,
            }),
        }
    )
);
