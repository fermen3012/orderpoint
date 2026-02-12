'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { ChefHat, ArrowRight, Loader2, Utensils, ShoppingBag } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { useCartStore } from '@/store/cart-store';

export default function WelcomePage({ params }: { params: Promise<{ locale: string }> }) {
    const resolvedParams = use(params);
    const locale = resolvedParams.locale;
    const router = useRouter();
    const supabase = createClient();

    const [restaurant, setRestaurant] = useState<{ name: string; logo_url: string | null } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadRestaurantData() {
            try {
                // 1. Get Session
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    // Not logged in? Show generic or redirect?
                    // User asked to show "logged in restaurant".
                    // If not logged in, we can't show it.
                    setLoading(false);
                    return;
                }

                // 2. Get Profile to find Restaurant ID
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('restaurant_id')
                    .eq('id', session.user.id)
                    .single();

                if (profile?.restaurant_id) {
                    // 3. Get Restaurant Details
                    const { data: restData } = await supabase
                        .from('restaurants')
                        .select('name, logo_url')
                        .eq('id', profile.restaurant_id)
                        .single();

                    if (restData) {
                        setRestaurant(restData);
                    }
                }
            } catch (error) {
                console.error("Error loading welcome data", error);
            } finally {
                setLoading(false);
            }
        }
        loadRestaurantData();
    }, [supabase]);

    const setOrderType = useCartStore((state) => state.setOrderType);

    const handleSelection = (type: 'dine_in' | 'takeout') => {
        setOrderType(type);
        router.push('/categories');
    };

    if (loading) {

        return <div className="fixed inset-0 bg-black flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
        </div>;
    }

    return (
        <div
            className="fixed inset-0 z-50 overflow-hidden bg-black select-none group"
        >
            {/* Background Image (Placeholder) */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1544025162-d76694265947?ixlib=rb-4.0.3&auto=format&fit=crop&w=2069&q=80')] bg-cover bg-center opacity-60 transition-transform duration-[20s] ease-linear transform scale-100 group-hover:scale-110" />

            {/* Dark Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/60" />

            {/* Content Centered */}
            <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 text-center space-y-8 animate-in fade-in zoom-in duration-1000">

                {/* Logo Area */}
                <div className="w-48 h-48 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 shadow-2xl shadow-primary-500/20 mb-8 animate-bounce-slow overflow-hidden p-4">
                    {restaurant?.logo_url ? (
                        <img
                            src={restaurant.logo_url}
                            alt={restaurant.name}
                            className="w-full h-full object-contain drop-shadow-xl"
                        />
                    ) : (
                        <ChefHat className="w-24 h-24 text-white drop-shadow-lg" />
                    )}
                </div>

                {/* Main Heading */}
                <div className="space-y-2">
                    <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase italic drop-shadow-2xl max-w-4xl leading-tight">
                        {restaurant ? `Bienvenido a ${restaurant.name}` : 'Bienvenido a OrderPoint'}
                    </h1>
                    {!restaurant && (
                        <p className="text-2xl md:text-3xl text-slate-300 font-light tracking-widest uppercase">
                            Kiosco de Autoservicio
                        </p>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="mt-12 flex flex-col sm:flex-row items-center gap-8 w-full max-w-2xl px-4 animate-slide-up-fade" style={{ animationDelay: '500ms' }}>

                    {/* Dine In Button */}
                    <button
                        onClick={() => handleSelection('dine_in')}
                        className="group/btn relative flex-1 w-full aspect-[4/3] bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-[2.5rem] flex flex-col items-center justify-center gap-6 transition-all duration-300 hover:scale-105 active:scale-95 shadow-2xl overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-primary-500/0 group-hover/btn:bg-primary-500/10 transition-colors duration-500" />
                        <div className="w-24 h-24 bg-primary-500 rounded-full flex items-center justify-center shadow-lg shadow-primary-500/30 group-hover/btn:scale-110 transition-transform duration-500">
                            <Utensils className="w-10 h-10 text-white" />
                        </div>
                        <span className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter italic">
                            Comer Aquí
                        </span>
                    </button>

                    {/* Takeout Button */}
                    <button
                        onClick={() => handleSelection('takeout')}
                        className="group/btn relative flex-1 w-full aspect-[4/3] bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-[2.5rem] flex flex-col items-center justify-center gap-6 transition-all duration-300 hover:scale-105 active:scale-95 shadow-2xl overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-orange-500/0 group-hover/btn:bg-orange-500/10 transition-colors duration-500" />
                        <div className="w-24 h-24 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover/btn:scale-110 transition-transform duration-500">
                            <ShoppingBag className="w-10 h-10 text-white" />
                        </div>
                        <span className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter italic">
                            Para Llevar
                        </span>
                    </button>

                </div>

                {/* Footer Hint */}
                <div className="absolute bottom-12 text-slate-400 text-sm font-bold uppercase tracking-[0.2em] opacity-60">
                    Kiosco de Autoservicio
                </div>
            </div>
        </div>
    );
}
