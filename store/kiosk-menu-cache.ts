import { create } from 'zustand';
import type { Database } from '@/lib/supabase/types';

type Category = Database['public']['Tables']['categories']['Row'];

interface KioskMenuCacheState {
    restaurantId: string | null;
    restaurantName: string | null;
    categories: Category[];
    products: any[];
    productIngredientsMap: Record<string, any[]>;
    timestamp: number;
    setKioskMenuCache: (data: {
        restaurantId: string;
        restaurantName?: string | null;
        categories: Category[];
        products: any[];
        productIngredientsMap?: Record<string, any[]>;
    }) => void;
    isCacheValid: (targetRestaurantId: string, ttlMs?: number) => boolean;
    invalidateCache: () => void;
}

const DEFAULT_TTL_MS = 3 * 60 * 1000; // 3 minutos

export const useKioskMenuCache = create<KioskMenuCacheState>((set, get) => ({
    restaurantId: null,
    restaurantName: null,
    categories: [],
    products: [],
    productIngredientsMap: {},
    timestamp: 0,

    setKioskMenuCache: (data) => {
        set({
            restaurantId: data.restaurantId,
            restaurantName: data.restaurantName !== undefined ? data.restaurantName : get().restaurantName,
            categories: data.categories,
            products: data.products,
            productIngredientsMap: data.productIngredientsMap || get().productIngredientsMap,
            timestamp: Date.now()
        });
    },

    isCacheValid: (targetRestaurantId: string, ttlMs: number = DEFAULT_TTL_MS) => {
        const state = get();
        if (!state.restaurantId || state.restaurantId !== targetRestaurantId) return false;
        if (state.products.length === 0) return false;
        const age = Date.now() - state.timestamp;
        return age < ttlMs;
    },

    invalidateCache: () => {
        set({
            restaurantId: null,
            restaurantName: null,
            categories: [],
            products: [],
            productIngredientsMap: {},
            timestamp: 0
        });
    }
}));
