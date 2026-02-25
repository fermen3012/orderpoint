'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@/lib/supabase/browser';
import QuickOrderMenu from '@/components/exo/QuickOrderMenu';
import { useExoCartStore } from '@/store/exo-cart-store';
import { useRestaurantStore } from '@/store/restaurant-store';
import { Loader2, ArrowLeft, Send } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { formatPrice } from '@/lib/utils';

export default function MenuPage({ params }: { params: Promise<{ table_id: string }> }) {
    const resolvedParams = use(params);
    const tableId = resolvedParams.table_id;
    const supabase = createClient();
    const router = useRouter();

    const [categories, setCategories] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);

    const {
        items,
        clearCart,
        getCartTotal,
        getCartCount,
        waitressId,
        setWaitressId,
        incrementPendingOrders,
        decrementPendingOrders
    } = useExoCartStore();

    const { restaurantId } = useRestaurantStore();

    useEffect(() => {
        async function loadData() {
            try {
                // Get Waitress ID if not set
                if (!waitressId) {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) setWaitressId(session.user.id);
                }

                if (!restaurantId) {
                    // Fallback to profile if store is empty
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                        const { data: profile } = await (supabase.from('profiles') as any).select('restaurant_id').eq('id', session.user.id).single();
                        if (profile?.restaurant_id) {
                            // This is just for local ref, store should ideally have it
                        }
                    }
                }

                // Parallel fetch filtered by restaurant
                const [catRes, prodRes] = await Promise.all([
                    (supabase.from('categories') as any).select('*').eq('restaurant_id', restaurantId).order('name'),
                    (supabase.from('products') as any)
                        .select('*, modifier_groups:product_modifier_groups(modifier_group:modifier_groups(*, options:modifiers(*))))')
                        .eq('restaurant_id', restaurantId)
                        .eq('is_available', true)
                ]);

                if (catRes.error) throw catRes.error;
                if (prodRes.error) throw prodRes.error;

                setCategories(catRes.data || []);

                // Flatten products data structure to match our types
                const formattedProducts = prodRes.data?.map((p: any) => ({
                    ...p,
                    modifier_groups: p.modifier_groups.map((mg: any) => ({
                        ...mg.modifier_group,
                        options: mg.modifier_group.options || []
                    }))
                })) || [];

                setProducts(formattedProducts);
            } catch (error) {
                console.error('Error loading menu data:', error);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [supabase, waitressId, setWaitressId, restaurantId]);

    const handleSendOrder = async () => {
        if (getCartCount() === 0 || !restaurantId) return;

        setIsSending(true);

        // Optimistic UI Flow
        incrementPendingOrders();
        const currentCart = [...items];
        const total = getCartTotal();

        // Clear cart immediately for the user
        clearCart();
        // In a real app we'd use a toast library that is installed
        console.log('¡Pedido enviado a cocina!');

        try {
            // Prepare data for Supabase as requested (items as JSONB)
            const orderItems = currentCart.map(item => ({
                product_id: item.product.id,
                name: item.product.name,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                total_price: item.totalPrice,
                modifiers: item.selectedModifiers
            }));

            const { error } = await (supabase.from('orders') as any).insert({
                restaurant_id: restaurantId,
                table_id: tableId,
                waitress_id: waitressId,
                items: orderItems,
                status: 'pending',
                source: 'exo_server',
                total_amount: total
            });

            if (error) throw error;

        } catch (error) {
            console.error('Error sending order:', error);
            // Re-throw or notify user if critical
        } finally {
            decrementPendingOrders();
            setIsSending(false);
            router.push('/exo/tables');
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Preparando Menú...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.push('/exo/tables')}
                    className="p-3 bg-slate-800 rounded-2xl border border-slate-700 active:scale-90 transition-transform"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                    <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-none">
                        Mesa <span className="text-emerald-500">#{tableId.substring(0, 3)}</span>
                    </h2>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">
                        Nuevo Pedido
                    </p>
                </div>
            </div>

            <QuickOrderMenu
                categories={categories}
                products={products}
            />

            {/* Bottom Bar (Cart Summary) */}
            {getCartCount() > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-6 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800 z-50 animate-in slide-in-from-bottom duration-300">
                    <button
                        onClick={handleSendOrder}
                        disabled={isSending}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 py-5 rounded-[24px] flex items-center justify-between px-8 shadow-[0_10px_30px_rgba(16,185,129,0.3)] transition-all active:scale-95 disabled:grayscale"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center">
                                <span className="text-emerald-500 font-black text-xs">{getCartCount()}</span>
                            </div>
                            <span className="text-xl font-black uppercase italic tracking-tighter">Enviar a Cocina</span>
                        </div>
                        <span className="text-2xl font-black tracking-tighter italic">
                            {formatPrice(getCartTotal())}
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
}
