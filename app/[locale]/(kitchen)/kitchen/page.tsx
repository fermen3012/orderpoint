'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase/client';
import { formatPrice, formatOrderNumber } from '@/lib/utils';
import { Clock, ChefHat, LogOut, Utensils, ShoppingBag, Smartphone, Monitor, User } from 'lucide-react';
import type { Database } from '@/lib/supabase/types';
import { use } from 'react';
import { useRouter } from '@/i18n/routing';
import { useAuth } from '@/components/auth/AuthContext';

type Order = Database['public']['Tables']['orders']['Row'] & {
    order_type?: 'dine_in' | 'takeout';
    table?: { number: string } | null;
    tables?: { number: string } | null;
    waitress?: { full_name: string } | null;
    waitress_id?: string | null;
    source?: string | null;
};
type OrderItem = Database['public']['Tables']['order_items']['Row'];

interface OrderWithItems extends Order {
    order_items: (OrderItem & { products: { name: string, category_id: string, categories: { name: string } | null } | null })[];
}

const STATUS_COLORS = {
    pending: 'bg-yellow-500',
    preparing: 'bg-blue-500',
    ready: 'bg-green-500',
    completed: 'bg-gray-500',
};

export default function KitchenPage({ params }: { params: Promise<{ locale: string }> }) {
    const resolvedParams = use(params);
    const locale = resolvedParams.locale;
    const t = useTranslations('kitchen');
    const router = useRouter();
    const { restaurantId } = useAuth();

    const STATUS_LABELS = {
        pending: t('pending'),
        preparing: t('preparing'),
        ready: t('ready'),
        completed: t('completed'),
    };

    const [orders, setOrders] = useState<OrderWithItems[]>([]);
    const [ingredientsMap, setIngredientsMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Load ingredients
    useEffect(() => {
        async function loadIngredients(rid: string) {
            const { data } = await (supabase
                .from('ingredients') as any)
                .select('id, name')
                .eq('restaurant_id', rid);

            if (data) {
                const map: Record<string, string> = {};
                (data as any[]).forEach(i => map[i.id] = i.name);
                setIngredientsMap(map);
            }
        }

        if (restaurantId) {
            loadIngredients(restaurantId);
        }
    }, [restaurantId]);

    // Load orders and subscribe to real-time updates
    useEffect(() => {
        if (!restaurantId) return;

        async function loadOrders() {
            const { data } = await (supabase
                .from('orders') as any)
                .select(`
          *,
          table:tables (
            number
          ),
          waitress:profiles!waitress_id (
            full_name
          ),
          order_items (
            *,
            products (
              name,
              category_id,
              categories (name)
            )
          )
        `)
                .eq('restaurant_id', restaurantId!)
                .neq('status', 'completed')
                .order('created_at', { ascending: true });

            if (data) {
                // Filter out items that are drinks and then filter out orders with no items left
                const filteredOrders = (data as any[]).map(order => ({
                    ...order,
                    order_items: order.order_items.filter((item: any) =>
                        item.products?.categories?.name !== 'Bebidas'
                    )
                })).filter(order => order.order_items.length > 0);

                setOrders(filteredOrders as OrderWithItems[]);
            }
            setLoading(false);
        }

        loadOrders();

        // Subscribe to real-time updates
        const channel = supabase
            .channel('kitchen-orders')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `restaurant_id=eq.${restaurantId}`,
                },
                () => {
                    loadOrders();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'order_items',
                },
                () => {
                    loadOrders();
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    loadOrders();
                }
            });

        // Resilience: Re-fetch when browser comes back online
        const handleOnline = () => {
            console.log('Browser online, re-fetching orders...');
            loadOrders();
        };
        window.addEventListener('online', handleOnline);

        return () => {
            supabase.removeChannel(channel);
            window.removeEventListener('online', handleOnline);
        };
    }, [restaurantId]);

    const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
        const updates: any = { status: newStatus };

        if (newStatus === 'preparing') updates.preparing_at = new Date().toISOString();
        if (newStatus === 'ready') updates.ready_at = new Date().toISOString();
        if (newStatus === 'completed') updates.completed_at = new Date().toISOString();

        await (supabase
            .from('orders') as any)
            .update(updates)
            .eq('id', orderId);
    };

    const getNextStatus = (currentStatus: Order['status']): Order['status'] | null => {
        const statusFlow: Order['status'][] = ['pending', 'preparing', 'ready', 'completed'];
        const currentIndex = statusFlow.indexOf(currentStatus);
        return currentIndex < statusFlow.length - 1 ? statusFlow[currentIndex + 1] : null;
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto mb-4"></div>
                    <p className="text-white text-lg">{t('loading')}</p>
                </div>
            </div>
        );
    }

    const ordersByStatus = {
        pending: orders.filter((o) => o.status === 'pending'),
        preparing: orders.filter((o) => o.status === 'preparing'),
        ready: orders.filter((o) => o.status === 'ready'),
    };

    return (
        <div className="min-h-screen bg-secondary-950 p-8">
            {/* Header */}
            <header className="mb-12 relative">
                <div className="absolute top-0 left-0 w-64 h-64 bg-primary-500/10 rounded-full -translate-y-1/2 -translate-x-1/2 blur-3xl" />
                <div className="flex items-center justify-between relative">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-primary-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-primary-500/20">
                            <ChefHat className="w-10 h-10 text-white" />
                        </div>
                        <div>
                            <h1 className="text-5xl font-black text-white tracking-tighter">{t('title')}</h1>
                            <p className="text-secondary-400 text-lg font-bold uppercase tracking-widest mt-1">
                                {mounted ? new Date().toLocaleDateString(locale === 'es' ? 'es-SV' : 'en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                }) : ''}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-4 bg-secondary-900/50 backdrop-blur-xl p-4 rounded-3xl border border-secondary-800">
                            <div className="flex flex-col items-end">
                                <span className="text-secondary-400 text-xs font-black uppercase tracking-tighter">{t('system')}</span>
                                <span className="text-accent-500 font-black">{t('online')}</span>
                            </div>
                            <div className="w-3 h-3 bg-accent-500 rounded-full animate-pulse shadow-lg shadow-accent-500/50" />
                        </div>

                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 px-6 py-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl border border-red-500/20 transition-all duration-300 font-black text-xs uppercase tracking-widest group shadow-lg shadow-red-500/10"
                        >
                            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                            <span>{t('logout') || 'Cerrar Sesión'}</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Orders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                {/* Pending Column */}
                <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
                    <div className="flex items-center justify-between mb-6 px-2">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-primary-500 shadow-lg shadow-primary-500/50" />
                            <h2 className="text-2xl font-black text-white tracking-tight">{t('pending')}</h2>
                        </div>
                        <span className="bg-primary-500/10 text-primary-500 px-4 py-1 rounded-2xl text-sm font-black border border-primary-500/20">
                            {ordersByStatus.pending.length}
                        </span>
                    </div>
                    <div className="space-y-6">
                        {ordersByStatus.pending.map((order) => (
                            <OrderCard
                                key={order.id}
                                order={order}
                                locale={locale}
                                mounted={mounted}
                                onStatusChange={updateOrderStatus}
                                getNextStatus={getNextStatus}
                                ingredientsMap={ingredientsMap}
                                t={t}
                                statusLabels={STATUS_LABELS}
                            />
                        ))}
                    </div>
                </div>

                {/* Preparing Column */}
                <div className="animate-slide-up" style={{ animationDelay: '200ms' }}>
                    <div className="flex items-center justify-between mb-6 px-2">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />
                            <h2 className="text-2xl font-black text-white tracking-tight">{t('preparing')}</h2>
                        </div>
                        <span className="bg-blue-500/10 text-blue-500 px-4 py-1 rounded-2xl text-sm font-black border border-blue-500/20">
                            {ordersByStatus.preparing.length}
                        </span>
                    </div>
                    <div className="space-y-6">
                        {ordersByStatus.preparing.map((order) => (
                            <OrderCard
                                key={order.id}
                                order={order}
                                locale={locale}
                                mounted={mounted}
                                onStatusChange={updateOrderStatus}
                                getNextStatus={getNextStatus}
                                ingredientsMap={ingredientsMap}
                                t={t}
                                statusLabels={STATUS_LABELS}
                            />
                        ))}
                    </div>
                </div>

                {/* Ready Column */}
                <div className="animate-slide-up" style={{ animationDelay: '300ms' }}>
                    <div className="flex items-center justify-between mb-6 px-2">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-accent-500 shadow-lg shadow-accent-500/50" />
                            <h2 className="text-2xl font-black text-white tracking-tight">{t('ready')}</h2>
                        </div>
                        <span className="bg-accent-500/10 text-accent-500 px-4 py-1 rounded-2xl text-sm font-black border border-accent-500/20">
                            {ordersByStatus.ready.length}
                        </span>
                    </div>
                    <div className="space-y-6">
                        {ordersByStatus.ready.map((order) => (
                            <OrderCard
                                key={order.id}
                                order={order}
                                locale={locale}
                                mounted={mounted}
                                onStatusChange={updateOrderStatus}
                                getNextStatus={getNextStatus}
                                ingredientsMap={ingredientsMap}
                                t={t}
                                statusLabels={STATUS_LABELS}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function OrderCard({
    order,
    locale,
    mounted,
    onStatusChange,
    getNextStatus,
    ingredientsMap,
    t,
    statusLabels,
}: {
    order: OrderWithItems;
    locale: string;
    mounted: boolean;
    onStatusChange: (id: string, status: Order['status']) => void;
    getNextStatus: (status: Order['status']) => Order['status'] | null;
    ingredientsMap: Record<string, string>;
    t: any;
    statusLabels: Record<string, string>;
}) {
    const nextStatus = getNextStatus(order.status);
    const timeSinceOrder = mounted ? Math.floor(
        (Date.now() - new Date(order.created_at).getTime()) / 60000
    ) : 0;

    const isExoServer = order.source === 'exo_server' || order.source === 'exo_server_closed' || Boolean(order.waitress_id || order.waitress || order.table_id || order.table);
    const waitressName = order.waitress?.full_name;
    const tableNumber = order.table?.number || (order as any).tables?.number;

    return (
        <div className="bg-secondary-900/40 backdrop-blur-md rounded-[2.5rem] p-7 shadow-2xl border border-secondary-800/50 hover:border-primary-500/50 transition-all duration-500 group animate-scale-in">
            {/* Order Header */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <span className="text-3xl font-black text-white tracking-tighter">
                            {formatOrderNumber(order.order_number)}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-secondary-400 text-sm font-bold uppercase tracking-widest">
                        <Clock className="w-4 h-4 text-primary-500" />
                        <span>{t('ago', { time: timeSinceOrder })}</span>
                    </div>

                    {/* Origin, Order Type & Table Badges */}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                        {/* Origin Badge */}
                        {isExoServer ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-widest bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                <Smartphone className="w-3 h-3 text-purple-400" />
                                <span>{t('sourceExoServer')}</span>
                            </div>
                        ) : (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Monitor className="w-3 h-3 text-amber-400" />
                                <span>{t('sourceKiosk')} • {t('orderNumberPrefix', { number: order.order_number })}</span>
                            </div>
                        )}

                        {/* Waitress Badge (if Exo Server) */}
                        {isExoServer && waitressName && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                <User className="w-3 h-3 text-indigo-400" />
                                <span>{t('waitress', { name: waitressName })}</span>
                            </div>
                        )}

                        {/* Table Badge */}
                        {tableNumber && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <Utensils className="w-3 h-3 text-emerald-400" />
                                <span>{t('table', { number: tableNumber })}</span>
                            </div>
                        )}

                        {/* Dine In / Takeout Badge */}
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-widest ${order.order_type === 'takeout'
                            ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20'
                            : 'bg-primary-500/10 text-primary-500 border border-primary-500/20'
                            }`}>
                            {order.order_type === 'takeout' ? (
                                <>
                                    <ShoppingBag className="w-3 h-3" />
                                    <span>{t('takeout')}</span>
                                </>
                            ) : (
                                <>
                                    <Utensils className="w-3 h-3" />
                                    <span>{t('dineIn')}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className={`
                    ${order.status === 'pending' ? 'bg-primary-500' : order.status === 'preparing' ? 'bg-blue-500' : 'bg-accent-500'} 
                    px-4 py-1.5 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-lg
                `}>
                    {statusLabels[order.status]}
                </div>
            </div>

            {/* Order Items */}
            <div className="space-y-4 mb-8">
                {order.order_items.map((item) => {
                    const modifiers = item.modifiers_json as any[];
                    const removedIngredients = (item as any).removed_ingredients as string[] | null;

                    return (
                        <div key={item.id} className="bg-secondary-800/30 rounded-3xl p-4 border border-secondary-700/30 group-hover:bg-secondary-800/50 transition-colors">
                            <div className="flex items-start gap-4">
                                <div className="bg-primary-500 text-white w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg shadow-lg shadow-primary-500/20">
                                    {item.quantity}
                                </div>
                                <div className="flex-1">
                                    <span className="text-white font-black text-lg leading-tight">
                                        {item.products?.name || `${t('product')} #${item.product_id?.slice(0, 8)}`}
                                    </span>
                                    {modifiers && modifiers.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            {modifiers.map((mod: any, idx: number) => (
                                                <div key={idx} className="text-xs font-bold text-secondary-400 uppercase tracking-tighter">
                                                    {mod.options.map((o: any) => o.name).join(', ')}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {removedIngredients && removedIngredients.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            <div className="text-xs font-black text-red-400 uppercase tracking-widest flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                                {t('removed')}: {removedIngredients.map(id => ingredientsMap[id] || id).join(', ')}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Action Button */}
            {nextStatus && (
                <button
                    onClick={() => onStatusChange(order.id, nextStatus)}
                    className={`
                        w-full py-5 px-6 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] transition-all duration-300 shadow-xl
                        ${nextStatus === 'completed'
                            ? 'bg-accent-500 hover:bg-accent-600 shadow-accent-500/20'
                            : 'bg-primary-500 hover:bg-primary-600 shadow-primary-500/20'
                        } 
                        text-white hover:-translate-y-1 active:scale-[0.98]
                    `}
                >
                    {t('markAs')} {statusLabels[nextStatus]}
                </button>
            )}
        </div>
    );
}
