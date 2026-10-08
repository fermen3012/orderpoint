'use client';

import { useEffect, useState, use } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import QuickOrderMenu from '@/components/exo/QuickOrderMenu';
import { useExoCartStore } from '@/store/exo-cart-store';
import { useRestaurantStore } from '@/store/restaurant-store';
import { Loader2, ArrowLeft, Send, LogOut, Trash2, AlertTriangle, CheckCircle2, Sparkles, X as CloseIcon, Receipt, Plus, Utensils, Clock } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { formatPrice, cn, getLocalizedValue } from '@/lib/utils';

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
    const [tableOrders, setTableOrders] = useState<any[]>([]);
    const [showMenu, setShowMenu] = useState(false);

    const {
        items,
        clearCart,
        getCartTotal,
        getCartCount,
        waitressId,
        setWaitressId,
        setTableId,
        incrementPendingOrders,
        decrementPendingOrders
    } = useExoCartStore();

    const { restaurantId, restaurantName, setRestaurant } = useRestaurantStore();

    // Synchronize active tableId in store with route table_id
    useEffect(() => {
        if (tableId) {
            setTableId(tableId);
        }
    }, [tableId, setTableId]);

    const loadTableOrders = async (targetRestaurantId?: string) => {
        const activeRid = targetRestaurantId || restaurantId;
        if (!tableId || !activeRid) return;
        try {
            const { data: ordersData, error: ordersErr } = await (supabase.from('orders') as any)
                .select(`
                    id,
                    order_number,
                    status,
                    total_amount,
                    created_at,
                    source,
                    order_items (
                        id,
                        quantity,
                        unit_price,
                        total_price,
                        modifiers_json,
                        removed_ingredients,
                        products (
                            name
                        )
                    )
                `)
                .eq('restaurant_id', activeRid)
                .eq('table_id', tableId)
                .neq('source', 'exo_server_closed')
                .order('created_at', { ascending: false });

            if (!ordersErr && ordersData) {
                setTableOrders(ordersData);
            }
        } catch (err) {
            console.error('Error fetching table orders:', err);
        }
    };

    useEffect(() => {
        let activeRestaurantId: string | null = restaurantId;

        async function loadData() {
            try {
                // Get Waitress ID if not set
                if (!waitressId) {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) setWaitressId(session.user.id);
                }

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
                        .select('*, modifier_groups:product_modifier_groups(modifier_group:modifier_groups(*, options:modifiers(*))), ingredients:product_ingredients(ingredient_id, is_removable, ingredient:ingredients(id, name))')
                        .eq('restaurant_id', activeRestaurantId)
                        .eq('is_available', true)
                ]);

                if (catRes.error) throw catRes.error;
                if (prodRes.error) throw prodRes.error;

                setCategories(catRes.data || []);

                // Flatten products data structure to match our types
                const formattedProducts = prodRes.data?.map((p: any) => ({
                    ...p,
                    modifier_groups: p.modifier_groups?.map((mg: any) => ({
                        ...mg.modifier_group,
                        options: mg.modifier_group?.options || []
                    })) || [],
                    removable_ingredients: p.ingredients
                        ?.filter((pi: any) => pi.is_removable && pi.ingredient)
                        ?.map((pi: any) => ({
                            id: pi.ingredient.id,
                            name: pi.ingredient.name
                        })) || []
                })) || [];

                setProducts(formattedProducts);

                // Fetch table status with waitress profile
                const { data: tableData } = await (supabase.from('tables') as any)
                    .select('*, waitress:profiles!waitress_id(full_name)')
                    .eq('id', tableId)
                    .single();

                if (tableData) setTable(tableData);

                // Fetch table orders
                await loadTableOrders(activeRestaurantId);

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

        // Subscribe to table orders changes in real time
        const ordersChannel = supabase
            .channel(`table-orders-${tableId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `table_id=eq.${tableId}` }, () => {
                if (activeRestaurantId) {
                    loadTableOrders(activeRestaurantId);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(ordersChannel);
        };
    }, [supabase, waitressId, setWaitressId, restaurantId, tableId]);

    const isOccupiedByOther = table?.waitress_id && table.waitress_id !== waitressId;

    const totalVenta = tableOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
    const totalItemsOrdered = tableOrders.reduce((sum, order) => {
        return sum + (order.order_items?.reduce((iSum: number, item: any) => iSum + (item.quantity || 1), 0) || 0);
    }, 0);

    const getOrderStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return {
                    label: locale === 'es' ? 'Pendiente' : 'Pending',
                    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                };
            case 'preparing':
                return {
                    label: locale === 'es' ? 'En Cocina' : 'Preparing',
                    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                };
            case 'ready':
                return {
                    label: locale === 'es' ? 'Listo' : 'Ready',
                    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                };
            case 'completed':
                return {
                    label: locale === 'es' ? 'Servido' : 'Served',
                    className: 'bg-slate-700/30 text-slate-400 border-slate-700/50'
                };
            default:
                return {
                    label: status,
                    className: 'bg-slate-800 text-slate-400 border-slate-700'
                };
        }
    };

    const handleVaciarMesa = async () => {
        if (!tableId) return;
        setIsVaciarLoading(true);
        try {
            const { error: tableErr } = await (supabase.from('tables') as any)
                .update({ waitress_id: null })
                .eq('id', tableId);

            if (tableErr) throw tableErr;

            let activeRestaurantId = restaurantId;
            if (!activeRestaurantId) {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    const { data: profile } = await (supabase.from('profiles') as any).select('restaurant_id').eq('id', session.user.id).single();
                    activeRestaurantId = profile?.restaurant_id;
                }
            }

            if (activeRestaurantId) {
                await (supabase.from('orders') as any)
                    .update({ source: 'exo_server_closed', status: 'completed' })
                    .eq('table_id', tableId)
                    .eq('restaurant_id', activeRestaurantId);
            }

            setTableOrders([]);
            clearCart();
            setIsVaciarModalOpen(false);
            router.push('/exo/tables');
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

        console.log('¡Enviando pedido a cocina!');

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
                modifiers_json: item.selectedModifiers, // Storing modifiers in the expected JSONB column
                removed_ingredients: item.removedIngredients?.map(ri => ri.name || ri.id) || []
            }));

            const { error: itemsError } = await (supabase.from('order_items') as any).insert(kitchenItems);

            if (itemsError) throw itemsError;

            // Clear cart only after confirmed successful database insert
            clearCart();

            // Refresh table orders immediately
            await loadTableOrders(finalRestaurantId);
            setShowMenu(false);

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
                        {isOccupiedByOther
                            ? (locale === 'es' ? `Ocupada por ${table?.waitress?.full_name || 'otro personal'}` : `Occupied by ${table?.waitress?.full_name || 'other staff'}`)
                            : (tableOrders.length > 0
                                ? (locale === 'es' ? `Comanda Activa • ${totalItemsOrdered} productos` : `Active Order • ${totalItemsOrdered} items`)
                                : (locale === 'es' ? 'Mesa Disponible' : 'Table Available'))}
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
                        <p className="text-slate-300 text-sm font-bold">
                            Esta mesa está siendo atendida por <span className="text-white font-black">{table?.waitress?.full_name || 'otra persona'}</span>. No puedes modificar sus órdenes.
                        </p>
                    </div>
                </div>
            )}

            {/* View Selector Tabs */}
            <div className="flex bg-slate-900/90 p-1.5 rounded-[22px] border border-slate-800">
                <button
                    onClick={() => setShowMenu(false)}
                    className={cn(
                        "flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2",
                        !showMenu
                            ? "bg-emerald-500 text-slate-900 shadow-[0_4px_15px_rgba(16,185,129,0.3)]"
                            : "text-slate-400 hover:text-white"
                    )}
                >
                    <Receipt className="w-4 h-4" />
                    <span>{locale === 'es' ? 'Comanda' : 'Orders'} {tableOrders.length > 0 && `(${tableOrders.length})`}</span>
                </button>
                <button
                    onClick={() => setShowMenu(true)}
                    className={cn(
                        "flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2",
                        showMenu
                            ? "bg-emerald-500 text-slate-900 shadow-[0_4px_15px_rgba(16,185,129,0.3)]"
                            : "text-slate-400 hover:text-white"
                    )}
                >
                    <Utensils className="w-4 h-4" />
                    <span>{locale === 'es' ? 'Menú / Agregar' : 'Menu / Add'}</span>
                </button>
            </div>

            {/* VISTA 1: COMANDA DE LA MESA Y TOTAL DE LA VENTA */}
            {!showMenu && (
                <div className="space-y-5 pb-28">
                    {/* Total de la Venta Card */}
                    <div className="p-6 bg-slate-900 rounded-[32px] border border-slate-800 shadow-xl relative overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                                {locale === 'es' ? 'Total de la Venta' : 'Total Sales'}
                            </span>
                            <span className="text-slate-400 text-xs font-bold">
                                {tableOrders.length} {tableOrders.length === 1 ? (locale === 'es' ? 'orden' : 'order') : (locale === 'es' ? 'órdenes' : 'orders')} • {totalItemsOrdered} {locale === 'es' ? 'artículos' : 'items'}
                            </span>
                        </div>
                        <div className="flex items-baseline justify-between mt-2">
                            <p className="text-4xl sm:text-5xl font-black text-white italic tracking-tighter">
                                {formatPrice(totalVenta, locale === 'es' ? 'es-SV' : 'en-US')}
                            </p>
                            <span className={cn(
                                "text-[10px] font-black uppercase tracking-widest px-3.5 py-1 rounded-full border transition-all",
                                table?.waitress_id
                                    ? "bg-gradient-to-r from-red-500/20 to-rose-500/10 text-red-400 border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.25)]"
                                    : "bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                            )}>
                                {table?.waitress_id ? (locale === 'es' ? 'Mesa Ocupada' : 'Occupied') : (locale === 'es' ? 'Mesa Disponible' : 'Available')}
                            </span>
                        </div>
                    </div>

                    {/* Lista de lo pedido */}
                    {tableOrders.length === 0 ? (
                        <div className="text-center py-16 bg-slate-900/40 rounded-[32px] border-2 border-dashed border-slate-800 p-8">
                            <Receipt className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                            <p className="text-white font-black text-lg uppercase italic tracking-tighter mb-1">
                                {locale === 'es' ? 'Mesa sin pedidos activos' : 'No active orders on this table'}
                            </p>
                            <p className="text-slate-500 text-xs font-bold mb-6">
                                {locale === 'es' ? 'Abre el menú para tomar la primera comanda de la mesa.' : 'Open the menu to take the first order for this table.'}
                            </p>
                            {!isOccupiedByOther && (
                                <button
                                    onClick={() => setShowMenu(true)}
                                    className="inline-flex items-center gap-2 px-6 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-2xl font-black uppercase tracking-wider text-xs shadow-lg transition-all active:scale-95"
                                >
                                    <Plus className="w-4 h-4 stroke-[3]" />
                                    <span>{locale === 'es' ? 'Abrir Menú y Ordenar' : 'Open Menu & Order'}</span>
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                                    {locale === 'es' ? 'Detalle de Comandas' : 'Orders Breakdown'}
                                </h3>
                                <span className="text-[10px] text-slate-500 font-bold uppercase">
                                    {locale === 'es' ? 'En Vivo' : 'Live'}
                                </span>
                            </div>

                            {tableOrders.map((order) => {
                                const statusBadge = getOrderStatusBadge(order.status);
                                return (
                                    <div key={order.id} className="p-5 bg-slate-900/90 rounded-[28px] border border-slate-800 space-y-3 shadow-lg">
                                        <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                                            <div className="flex items-center gap-2.5">
                                                <span className="font-black text-white text-base italic tracking-tighter uppercase">
                                                    {locale === 'es' ? 'ORDEN' : 'ORDER'} #{order.order_number}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-500">
                                                    • {new Date(order.created_at).toLocaleTimeString(locale === 'es' ? 'es-SV' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <span className={cn("px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border", statusBadge.className)}>
                                                {statusBadge.label}
                                            </span>
                                        </div>

                                        <div className="space-y-2">
                                            {order.order_items?.map((item: any, idx: number) => (
                                                <div key={item.id || idx} className="flex justify-between items-start gap-3 py-1">
                                                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                                        <span className="min-w-6 h-6 rounded-lg bg-slate-800 text-emerald-400 font-black text-xs flex items-center justify-center flex-shrink-0">
                                                            {item.quantity}
                                                        </span>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-bold text-slate-200 truncate">
                                                                {getLocalizedValue(item.products?.name, locale)}
                                                            </p>
                                                            {item.modifiers_json && item.modifiers_json.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {item.modifiers_json.map((mod: any, mIdx: number) => (
                                                                        <span key={mIdx} className="text-[9px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                                                                            {mod.options ? mod.options.map((o: any) => o.name).join(', ') : ''}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {item.removed_ingredients && item.removed_ingredients.length > 0 && (
                                                                <p className="text-[9px] font-bold text-red-400 mt-0.5">
                                                                    {locale === 'es' ? 'Sin' : 'No'}: {item.removed_ingredients.map((ri: any) => ri.name || ri).join(', ')}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className="text-xs font-black text-white whitespace-nowrap">
                                                        {formatPrice(Number(item.unit_price) * item.quantity, locale === 'es' ? 'es-SV' : 'en-US')}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex justify-between items-center pt-2 border-t border-slate-800/40 text-xs">
                                            <span className="text-slate-500 font-bold uppercase text-[10px]">
                                                {locale === 'es' ? 'Subtotal Comanda' : 'Order Subtotal'}
                                            </span>
                                            <span className="font-black text-emerald-400">
                                                {formatPrice(Number(order.total_amount), locale === 'es' ? 'es-SV' : 'en-US')}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Botón flotante para mostrar el menú y agregar más */}
                    {!isOccupiedByOther && (
                        <div className="fixed bottom-6 left-0 right-0 px-6 flex justify-center z-40 pointer-events-none">
                            <button
                                onClick={() => setShowMenu(true)}
                                className="pointer-events-auto bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black px-7 py-4.5 rounded-full shadow-[0_12px_35px_rgba(16,185,129,0.4)] flex items-center gap-3 transition-all active:scale-95 uppercase tracking-wider text-xs sm:text-sm border-2 border-emerald-400/50 group"
                            >
                                <div className="w-7 h-7 rounded-full bg-slate-900 text-emerald-400 flex items-center justify-center group-hover:rotate-90 transition-transform">
                                    <Plus className="w-4 h-4 stroke-[3]" />
                                </div>
                                <span>{locale === 'es' ? 'Mostrar Menú y Agregar Más' : 'Show Menu & Add More'}</span>
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* VISTA 2: MENÚ PARA AGREGAR MÁS PRODUCTOS */}
            {showMenu && (
                <div className="space-y-4 pb-28">
                    <div className="flex items-center justify-between p-4 bg-slate-900/90 border border-slate-800 rounded-2xl">
                        <button
                            onClick={() => setShowMenu(false)}
                            className="flex items-center gap-2 text-emerald-400 font-black uppercase text-xs tracking-wider hover:text-emerald-300 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>{locale === 'es' ? 'Ver Comanda de la Mesa' : 'View Table Order'}</span>
                        </button>
                        <div className="text-right">
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">
                                {locale === 'es' ? 'Venta Acumulada' : 'Current Total'}
                            </span>
                            <span className="text-emerald-500 font-black text-sm italic">
                                {formatPrice(totalVenta, locale === 'es' ? 'es-SV' : 'en-US')}
                            </span>
                        </div>
                    </div>

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
                                    <span className="text-xl font-black uppercase italic tracking-tighter">
                                        {isSending ? (locale === 'es' ? 'Enviando...' : 'Sending...') : (locale === 'es' ? 'Enviar a Cocina' : 'Send to Kitchen')}
                                    </span>
                                </div>
                                <span className="text-2xl font-black tracking-tighter italic">
                                    {formatPrice(getCartTotal(), locale === 'es' ? 'es-SV' : 'en-US')}
                                </span>
                            </button>
                        </div>
                    )}
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
                        <div className="p-6 bg-slate-800/50 border-t border-slate-800 flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    setIsSuccessModalOpen(false);
                                    setShowMenu(false);
                                }}
                                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-[2rem] font-black uppercase tracking-widest text-xs transition-all active:scale-95 shadow-[0_10px_20px_rgba(16,185,129,0.2)]"
                            >
                                {locale === 'es' ? 'Ver Comanda de la Mesa' : 'View Table Order'}
                            </button>
                            <button
                                onClick={() => {
                                    setIsSuccessModalOpen(false);
                                    router.push('/exo/tables');
                                }}
                                className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs transition-all active:scale-95"
                            >
                                {locale === 'es' ? 'Ir al Salón de Mesas' : 'Back to Tables'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
