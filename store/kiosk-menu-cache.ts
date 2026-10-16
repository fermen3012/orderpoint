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
    exoRestaurantId: string | null;
    exoCategories: any[];
    exoProducts: any[];
    exoWaitressName: string | null;
    exoTimestamp: number;
    setKioskMenuCache: (data: {
        restaurantId: string;
        restaurantName?: string | null;
        categories: Category[];
        products: any[];
        productIngredientsMap?: Record<string, any[]>;
    }) => void;
    isCacheValid: (targetRestaurantId: string, ttlMs?: number) => boolean;
    setExoMenuCache: (data: {
        restaurantId: string;
        categories: any[];
        products: any[];
        waitressName?: string | null;
    }) => void;
    isExoCacheValid: (targetRestaurantId: string, ttlMs?: number) => boolean;
    invalidateCache: () => void;
}

const DEFAULT_TTL_MS = 3 * 60 * 1000; // 3 minutos
const DEFAULT_EXO_TTL_MS = 5 * 60 * 1000; // 5 minutos para meseras en salón

export const useKioskMenuCache = create<KioskMenuCacheState>((set, get) => ({
    restaurantId: null,
    restaurantName: null,
    categories: [],
    products: [],
    productIngredientsMap: {},
    timestamp: 0,
    exoRestaurantId: null,
    exoCategories: [],
    exoProducts: [],
    exoWaitressName: null,
    exoTimestamp: 0,

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

    setExoMenuCache: (data) => {
        set({
            exoRestaurantId: data.restaurantId,
            exoCategories: data.categories,
            exoProducts: data.products,
            exoWaitressName: data.waitressName !== undefined ? data.waitressName : get().exoWaitressName,
            exoTimestamp: Date.now()
        });
    },

    isExoCacheValid: (targetRestaurantId: string, ttlMs: number = DEFAULT_EXO_TTL_MS) => {
        const state = get();
        if (!state.exoRestaurantId || state.exoRestaurantId !== targetRestaurantId) return false;
        if (state.exoProducts.length === 0) return false;
        const age = Date.now() - state.exoTimestamp;
        return age < ttlMs;
    },

    invalidateCache: () => {
        set({
            restaurantId: null,
            restaurantName: null,
            categories: [],
            products: [],
            productIngredientsMap: {},
            timestamp: 0,
            exoRestaurantId: null,
            exoCategories: [],
            exoProducts: [],
            exoWaitressName: null,
            exoTimestamp: 0
        });
    }
}));
