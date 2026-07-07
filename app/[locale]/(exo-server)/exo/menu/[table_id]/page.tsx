'use client';

import { useEffect, useState, use } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import QuickOrderMenu from '@/components/exo/QuickOrderMenu';
import { useExoCartStore } from '@/store/exo-cart-store';
import { useRestaurantStore } from '@/store/restaurant-store';
import { Loader2, ArrowLeft, Send, LogOut, Trash2, AlertTriangle, CheckCircle2, Sparkles, X as CloseIcon } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { formatPrice } from '@/lib/utils';

export default function MenuPage({ params }: { params: Promise<{ table_id: string }> }) {
    const resolvedParams = use(params);
    const tableId = resolvedParams.table_id;
    const urlParams = useParams();
    const locale = (urlParams?.locale as string) || 'es';
    const supabase = createClient();
    const router = useRouter();

    const [categories, setCategories] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [table, setTable] = useState<any>(null);
    const [isVaciarModalOpen, setIsVaciarModalOpen] = useState(false);
    const [isVaciarLoading, setIsVaciarLoading] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

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

    const { restaurantId, restaurantName, setRestaurant } = useRestaurantStore();

    useEffect(() => {
        async function loadData() {
            try {
                // Get Waitress ID if not set
                if (!waitressId) {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) setWaitressId(session.user.id);
                }

                let activeRestaurantId = restaurantId;

                if (!activeRestaurantId) {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                        const { data: profile } = await (supabase.from('profiles') as any)
                            .select('restaurant_id, restaurants(name)')
                            .eq('id', session.user.id)
                            .single();
                        if (profile?.restaurant_id) {
                            activeRestaurantId = profile.restaurant_id;
                            if (profile.restaurants?.name) {
                                setRestaurant(profile.restaurant_id, profile.restaurants.name);
                            }
                        }
                    }
                }

                if (!activeRestaurantId) {
                    console.warn('No restaurant ID found, skipping data load');
                    setLoading(false);
                    return;
                }

                // Parallel fetch filtered by restaurant
                const [catRes, prodRes] = await Promise.all([
                    (supabase.from('categories') as any).select('*').eq('restaurant_id', activeRestaurantId).order('name'),
                    (supabase.from('products') as any)
                        .select('*, modifier_groups:product_modifier_groups(modifier_group:modifier_groups(*, options:modifiers(*)))')
                        .eq('restaurant_id', activeRestaurantId)
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

                // Fetch table status
                const { data: tableData } = await (supabase.from('tables') as any)
                    .select('*')
                    .eq('id', tableId)
                    .single();

                if (tableData) setTable(tableData);

            } catch (error: any) {
                console.error('Error loading menu data:', error.message || error);
            } finally {
                setLoading(false);
            }
        }

        loadData();

        // Subscribe to table changes
        const channel = supabase
            .channel(`table-${tableId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tables', filter: `id=eq.${tableId}` }, (payload) => {
                setTable(payload.new);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, waitressId, setWaitressId, restaurantId, tableId]);

    const isOccupiedByOther = table?.waitress_id && table.waitress_id !== waitressId;

    const handleVaciarMesa = async () => {
        if (!tableId) return;
        setIsVaciarLoading(true);
        try {
            const { error } = await (supabase.from('tables') as any)
                .update({ waitress_id: null })
                .eq('id', tableId);

            if (error) throw error;
            setIsVaciarModalOpen(false);
        } catch (error: any) {
            alert('Error al desocupar mesa: ' + error.message);
        } finally {
            setIsVaciarLoading(false);
        }
    };

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
            // Ensure we have a restaurantId
            let finalRestaurantId = restaurantId;
            if (!finalRestaurantId) {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    const { data: profile } = await (supabase.from('profiles') as any).select('restaurant_id').eq('id', session.user.id).single();
                    finalRestaurantId = profile?.restaurant_id;
                }
            }

            if (!finalRestaurantId) throw new Error('No se pudo determinar el ID del restaurante');

            // 0. Get next atomic order number for this restaurant
            const { data: nextNumber, error: rpcError } = await (supabase as any).rpc('get_next_order_number', {
                p_restaurant_id: finalRestaurantId
            });

            if (rpcError) throw rpcError;

            // 1. Ensure table is "occupied" by current waitress if it's free
            if (!table?.waitress_id) {
                await (supabase.from('tables') as any)
                    .update({ waitress_id: waitressId })
                    .eq('id', tableId);
            }

            // 2. Prepare data for Supabase as requested (items as JSONB)
            const orderItems = currentCart.map(item => ({
                product_id: item.product.id,
                name: item.product.name?.[locale] || item.product.name?.es || (typeof item.product.name === 'string' ? item.product.name : ''),
                quantity: item.quantity,
                unit_price: item.unitPrice,
                total_price: item.totalPrice,
                modifiers: item.selectedModifiers
            }));

            const { data: orderData, error: orderError } = await (supabase.from('orders') as any).insert({
                restaurant_id: finalRestaurantId,
                table_id: tableId,
                waitress_id: waitressId,
                items: orderItems, // Keeping JSONB for backward compatibility
                status: 'pending',
                source: 'exo_server',
                total_amount: total,
                order_type: 'dine_in',
                order_number: nextNumber
            }).select('id').single();

            if (orderError) throw orderError;

            // 3. NEW: Insert into order_items table for kitchen visibility
            const kitchenItems = currentCart.map(item => ({
                order_id: orderData.id,
                product_id: item.product.id,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                total_price: item.totalPrice,
                modifiers_json: item.selectedModifiers // Storing modifiers in the expected JSONB column
            }));

            const { error: itemsError } = await (supabase.from('order_items') as any).insert(kitchenItems);

            if (itemsError) throw itemsError;

        } catch (error: any) {
            console.error('Error sending order:', error.message || error);
            alert('Error al enviar pedido: ' + (error.message || 'Error desconocido'));
            // If error, we might want to let the user try again
            setIsSending(false);
            decrementPendingOrders();
            return;
        }

        // Success flow
        decrementPendingOrders();
        setIsSending(false);
        setIsSuccessModalOpen(true);
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
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">{restaurantName || 'OrderPoint'}</span>
                    </div>
                    <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-none">
                        Mesa <span className="text-emerald-500">#{table?.number || tableId.substring(0, 3)}</span>
                    </h2>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">
                        {isOccupiedByOther ? 'Ocupada por otro personal' : 'Nuevo Pedido'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {table?.waitress_id && (
                        <button
                            onClick={() => setIsVaciarModalOpen(true)}
                            className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl border border-amber-500/20 active:scale-90 transition-transform group"
                            title="Desocupar Mesa"
                        >
                            <Trash2 className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                        </button>
                    )}
                    <button
                        onClick={async () => {
                            await supabase.auth.signOut();
                            router.push('/login');
                        }}
                        className="p-3 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 active:scale-90 transition-transform group"
                        title="Cerrar Sesión"
                    >
                        <LogOut className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                    </button>
                </div>
            </div>

            {isOccupiedByOther && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-[2rem] flex items-center gap-4 animate-in fade-in slide-in-from-top duration-500">
                    <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-6 h-6 text-slate-900" />
                    </div>
                    <div>
                        <p className="text-amber-500 font-black uppercase tracking-widest text-[10px]">Atención</p>
                        <p className="text-slate-300 text-sm font-bold">Esta mesa ya está siendo atendida. No puedes agregar órdenes.</p>
                    </div>
                </div>
            )}

            <QuickOrderMenu
                categories={categories}
                products={products}
            />

            {/* Bottom Bar (Cart Summary) */}
            {getCartCount() > 0 && !isOccupiedByOther && (
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

            {/* Vaciar Mesa Modal */}
            {isVaciarModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 w-full max-w-sm rounded-[3rem] border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 text-center">
                            <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
                                <AlertTriangle className="w-10 h-10 text-amber-500" />
                            </div>
                            <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-2">¿Desocupar Mesa?</h3>
                            <p className="text-slate-500 font-bold text-sm">
                                Se eliminará la asignación actual. La mesa quedará libre para que cualquier mesera pueda tomar órdenes.
                            </p>
                        </div>
                        <div className="p-6 bg-slate-800/50 border-t border-slate-800 flex flex-col gap-3">
                            <button
                                onClick={handleVaciarMesa}
                                disabled={isVaciarLoading}
                                className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isVaciarLoading ? 'Limpiando...' : 'Sí, Vaciar Mesa'}
                            </button>
                            <button
                                onClick={() => setIsVaciarModalOpen(false)}
                                className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {isSuccessModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-500">
                    <div className="bg-slate-900 w-full max-w-sm rounded-[3rem] border border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.1)] overflow-hidden animate-in zoom-in-95 duration-500">
                        <div className="p-10 text-center relative overflow-hidden">
                            {/* Animated Background Decoration */}
                            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-emerald-500/10 to-transparent pointer-events-none" />
                            <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl" />
                            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl" />

                            <div className="relative z-10 flex flex-col items-center">
                                <div className="w-24 h-24 bg-emerald-500 rounded-3xl flex items-center justify-center mb-6 shadow-[0_20px_40px_rgba(16,185,129,0.3)] rotate-3 animate-in zoom-in-50 duration-500">
                                    <CheckCircle2 className="w-12 h-12 text-slate-900" />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-center gap-2">
                                        <Sparkles className="w-4 h-4 text-emerald-500 animate-pulse" />
                                        <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase">¡Enviado!</h3>
                                        <Sparkles className="w-4 h-4 text-emerald-500 animate-pulse" />
                                    </div>
                                    <p className="text-slate-400 font-bold text-sm leading-tight">
                                        El pedido se ha enviado con éxito.<br />
                                        ¡La cocina ya está en marcha!
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-800/50 border-t border-slate-800">
                            <button
                                onClick={() => {
                                    setIsSuccessModalOpen(false);
                                    router.push('/exo/tables');
                                }}
                                className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-[2rem] font-black uppercase tracking-widest transition-all active:scale-95 shadow-[0_10px_20px_rgba(16,185,129,0.2)]"
                            >
                                Continuar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
