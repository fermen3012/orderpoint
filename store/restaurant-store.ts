import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RestaurantStore {
    restaurantId: string | null;
    restaurantName: string | null;
    setRestaurant: (id: string, name: string) => void;
}

export const useRestaurantStore = create<RestaurantStore>()(
    persist(
        (set) => ({
            restaurantId: null,
            restaurantName: null,
            setRestaurant: (id, name) => {
                set({ restaurantId: id, restaurantName: name });
            },
        }),
        {
            name: 'orderpoint-restaurant',
        }
    )
);
