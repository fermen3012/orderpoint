'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from '@/i18n/routing';
import {
    LayoutDashboard,
    ShoppingBag,
    Users,
    TrendingUp,
    LogOut,
    Package,
    List,
    Clock,
    Eye,
    Sparkles,
    X as CloseIcon,
    Smartphone,
    Monitor,
    User,
    Utensils,
    DollarSign,
    Flame,
    Award
} from 'lucide-react';
import { formatPrice } from '@/lib/utils';

import { useAuth } from '@/components/auth/AuthContext';

export default function DashboardPage() {
    const t = useTranslations('admin');
    const locale = useLocale();
    const router = useRouter();
    const { restaurantId } = useAuth();
    
    const getLocalizedValue = (field: any, currentLang: string): string => {
        if (!field) return '';
        let current = field;
        for (let i = 0; i < 5; i++) {
            if (typeof current === 'string') {
                const trimmed = current.trim();
                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                    try {
                        const parsed = JSON.parse(trimmed);
                        if (parsed !== null && parsed !== undefined) {
                            current = parsed;
                            continue;
                        }
                    } catch (e) {
                        try {
                            const fixed = trimmed.replace(/""/g, '"');
                            const parsed = JSON.parse(fixed);
                            if (parsed !== null && parsed !== undefined) {
                                current = parsed;
                                continue;
                            }
                        } catch (err) {}
                    }
                }
                break;
            } else if (current && typeof current === 'object') {
                const foundKey = Object.keys(current).find(pk => pk.toLowerCase() === currentLang.toLowerCase());
                if (foundKey) {
                    current = current[foundKey];
                } else {
                    const esKey = Object.keys(current).find(pk => pk.toLowerCase() === 'es');
                    if (esKey) {
                        current = current[esKey];
                    } else {
                        const firstKey = Object.keys(current)[0];
                        current = firstKey ? current[firstKey] : '';
                    }
                }
            } else {
                break;
            }
        }
        return typeof current === 'string' ? current : (current ? String(current) : '');
    };

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        todaySales: 0,
        todayOrders: 0,
        todayAverageTicket: 0,
        averageTicket: 0,
        totalSales: 0,
        totalOrders: 0,
        activeKitchenOrders: 0,
        pendingOrders: 0,
        preparingOrders: 0,
        activeProducts: 0,
        categories: 0
    });
    const [channelStats, setChannelStats] = useState({
        kioskOrders: 0,
        kioskSales: 0,
        kioskPercent: 50,
        exoOrders: 0,
        exoSales: 0,
        exoPercent: 50
    });
    const [topDishes, setTopDishes] = useState<Array<{ id: string; name: any; quantity: number; revenue: number }>>([]);
    const [topWaitresses, setTopWaitresses] = useState<Array<{ name: string; ordersCount: number; sales: number }>>([]);
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const [mounted, setMounted] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        setMounted(true);
        if (restaurantId) {
            loadDashboardData();
        }
    }, [restaurantId]);

    const loadDashboardData = async () => {
        if (!restaurantId) return;
        setLoading(true);
        try {
            // Fetch stats
            const [ordersRes, productsRes, categoriesRes] = await Promise.all([
                (supabase.from('orders') as any)
                    .select('*, table:tables(number), waitress:profiles!waitress_id(full_name), order_items(*, products(name))')
                    .eq('restaurant_id', restaurantId),
                (supabase.from('products') as any)
                    .select('*', { count: 'exact', head: true })
                    .eq('restaurant_id', restaurantId),
                (supabase.from('categories') as any)
                    .select('*', { count: 'exact', head: true })
                    .eq('restaurant_id', restaurantId)
            ]);

            if (ordersRes.data) {
                const orders = ordersRes.data as any[];

                // Métricas Generales
                const totalSales = orders.reduce((acc, order) => acc + (Number(order.total_amount) || 0), 0);
                const averageTicket = orders.length > 0 ? totalSales / orders.length : 0;

                // Métricas de Hoy
                const todayStr = new Date().toDateString();
                const todayOrdersList = orders.filter(o => new Date(o.created_at).toDateString() === todayStr);
                const todaySales = todayOrdersList.reduce((acc, o) => acc + (Number(o.total_amount) || 0), 0);
                const todayAverageTicket = todayOrdersList.length > 0 ? todaySales / todayOrdersList.length : 0;

                // Órdenes en Cocina
                const pendingOrders = orders.filter(o => o.status === 'pending').length;
                const preparingOrders = orders.filter(o => o.status === 'preparing').length;
                const activeKitchenOrders = pendingOrders + preparingOrders;

                setStats({
                    todaySales,
                    todayOrders: todayOrdersList.length,
                    todayAverageTicket,
                    averageTicket,
                    totalSales,
                    totalOrders: orders.length,
                    activeKitchenOrders,
                    pendingOrders,
                    preparingOrders,
                    activeProducts: productsRes.count || 0,
                    categories: categoriesRes.count || 0
                });

                // Canales de Venta (Kiosko vs Exo Server)
                let kioskOrders = 0;
                let kioskSales = 0;
                let exoOrders = 0;
                let exoSales = 0;

                orders.forEach(order => {
                    const isExo = order.source === 'exo_server' || order.source === 'exo_server_closed' || Boolean(order.waitress_id || order.waitress || order.table_id || order.table);
                    const amount = Number(order.total_amount) || 0;
                    if (isExo) {
                        exoOrders++;
                        exoSales += amount;
                    } else {
                        kioskOrders++;
                        kioskSales += amount;
                    }
                });

                const totalChannelVolume = (kioskSales + exoSales) || 1;
                const kioskPercent = Math.round((kioskSales / totalChannelVolume) * 100);
                const exoPercent = 100 - kioskPercent;

                setChannelStats({
                    kioskOrders,
                    kioskSales,
                    kioskPercent,
                    exoOrders,
                    exoSales,
                    exoPercent
                });

                // Top 5 Platillos Más Vendidos
                const productMap = new Map<string, { id: string; name: any; quantity: number; revenue: number }>();
                orders.forEach(order => {
                    if (order.status === 'cancelled') return;
                    order.order_items?.forEach((item: any) => {
                        const pId = item.product_id || (typeof item.products?.name === 'string' ? item.products.name : JSON.stringify(item.products?.name || 'unknown'));
                        const qty = Number(item.quantity) || 1;
                        const unitPrice = Number(item.unit_price) || 0;
                        const existing = productMap.get(pId);
                        if (existing) {
                            existing.quantity += qty;
                            existing.revenue += (unitPrice * qty);
                        } else {
                            productMap.set(pId, {
                                id: pId,
                                name: item.products?.name,
                                quantity: qty,
                                revenue: unitPrice * qty
                            });
                        }
                    });
                });

                const sortedDishes = Array.from(productMap.values())
                    .sort((a, b) => b.quantity - a.quantity)
                    .slice(0, 5);
                setTopDishes(sortedDishes);

                // Rendimiento de Meseras
                const waitressMap = new Map<string, { name: string; ordersCount: number; sales: number }>();
                orders.forEach(order => {
                    const waitressName = order.waitress?.full_name;
                    if (waitressName) {
                        const existing = waitressMap.get(waitressName);
                        const amount = Number(order.total_amount) || 0;
                        if (existing) {
                            existing.ordersCount++;
                            existing.sales += amount;
                        } else {
                            waitressMap.set(waitressName, {
                                name: waitressName,
                                ordersCount: 1,
                                sales: amount
                            });
                        }
                    }
                });

                const sortedWaitresses = Array.from(waitressMap.values())
                    .sort((a, b) => b.sales - a.sales)
                    .slice(0, 4);
                setTopWaitresses(sortedWaitresses);

                // Sort and take recent 5
                const sorted = [...orders].sort((a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                ).slice(0, 5);
                setRecentOrders(sorted);
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    const calculateTime = (start: string, end: string | null) => {
        if (!end) return null;
        const diff = new Date(end).getTime() - new Date(start).getTime();
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">{t('loadingData')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-8 h-1 bg-emerald-500 rounded-full"></span>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">{t('overview')}</span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        {t('dashboard')}
                    </h1>
                </div>

                <div className="flex items-center gap-4 bg-slate-900/50 backdrop-blur-md p-2 rounded-[2rem] border border-slate-800">
                    <div className="flex items-center gap-3 px-6 py-3 bg-emerald-500/10 rounded-[1.5rem] border border-emerald-500/20">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none">{t('statusOnline')}</span>
                    </div>
                </div>
            </div>

            {/* Stats Grid - High Value Business KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    icon={<DollarSign className="w-6 h-6" />}
                    label={locale === 'es' ? 'Ventas de Hoy' : 'Today Sales'}
                    value={formatPrice(stats.todaySales, locale === 'es' ? 'es-SV' : 'en-US')}
                    trend={`${stats.todayOrders} ${locale === 'es' ? 'pedidos hoy' : 'orders today'}`}
                    color="emerald"
                    delay="delay-[100ms]"
                />
                <StatCard
                    icon={<TrendingUp className="w-6 h-6" />}
                    label={locale === 'es' ? 'Ticket Promedio' : 'Average Ticket'}
                    value={formatPrice(stats.averageTicket, locale === 'es' ? 'es-SV' : 'en-US')}
                    trend={stats.todayAverageTicket > 0 ? (locale === 'es' ? `Hoy: ${formatPrice(stats.todayAverageTicket, 'es-SV')}` : `Today: ${formatPrice(stats.todayAverageTicket, 'en-US')}`) : undefined}
                    color="blue"
                    delay="delay-[200ms]"
                />
                <StatCard
                    icon={<Clock className="w-6 h-6" />}
                    label={locale === 'es' ? 'En Cocina Ahora' : 'In Kitchen Now'}
                    value={stats.activeKitchenOrders.toString()}
                    trend={`${stats.pendingOrders} ${locale === 'es' ? 'en espera' : 'waiting'}`}
                    color="amber"
                    delay="delay-[300ms]"
                />
                <StatCard
                    icon={<ShoppingBag className="w-6 h-6" />}
                    label={t('totalSales')}
                    value={formatPrice(stats.totalSales, locale === 'es' ? 'es-SV' : 'en-US')}
                    trend={`${stats.totalOrders} ${locale === 'es' ? 'pedidos' : 'orders'}`}
                    color="purple"
                    delay="delay-[400ms]"
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Recent Orders List */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">{t('recentOrders')}</h2>
                        <button className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition-all font-black text-[10px] uppercase tracking-widest">
                            {t('viewAll')}
                        </button>
                    </div>

                    <div className="space-y-4">
                        {recentOrders.map((order) => (
                            <div
                                key={order.id}
                                onClick={() => setSelectedOrder(order)}
                                className="group bg-slate-900/30 hover:bg-slate-900/60 backdrop-blur-sm p-6 rounded-[2.5rem] border border-slate-800/50 hover:border-emerald-500/30 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-6"
                            >
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-slate-800 rounded-2xl flex flex-col items-center justify-center border border-slate-700 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 transition-colors">
                                        <span className="text-[10px] font-black text-slate-500 group-hover:text-emerald-500 transition-colors">#</span>
                                        <span className="text-xl font-black text-white tracking-tighter">{order.order_number}</span>
                                    </div>
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${order.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                                                order.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                                                    'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                                }`}>
                                                {t(`status${order.status.charAt(0).toUpperCase() + order.status.slice(1)}` as any) || order.status}
                                            </span>
                                            {(() => {
                                                const isExo = order.source === 'exo_server' || order.source === 'exo_server_closed' || Boolean(order.waitress_id || order.waitress || order.table_id || order.table);
                                                return isExo ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                                        <Smartphone className="w-2.5 h-2.5" />
                                                        Exo Server
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                        <Monitor className="w-2.5 h-2.5" />
                                                        {locale === 'es' ? 'Kiosko' : 'Kiosk'}
                                                    </span>
                                                );
                                            })()}
                                            {order.waitress?.full_name && (
                                                <span className="text-[10px] font-black text-indigo-300">
                                                    {locale === 'es' ? 'Mesera:' : 'Waitress:'} {order.waitress.full_name}
                                                </span>
                                            )}
                                            {(order.table?.number || order.tables?.number) && (
                                                <span className="text-[10px] font-black text-emerald-400">
                                                    {locale === 'es' ? `Mesa #${order.table?.number || order.tables?.number}` : `Table #${order.table?.number || order.tables?.number}`}
                                                </span>
                                            )}
                                            <span className="text-[10px] font-bold text-slate-500">
                                                {mounted ? new Date(order.created_at).toLocaleTimeString(locale === 'es' ? 'es-SV' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                        </div>
                                        <p className="text-slate-400 font-bold text-sm">
                                            {getLocalizedValue(order.order_items?.[0]?.products?.name, locale) || (locale === 'es' ? 'Plato' : 'Dish')} {order.order_items?.length > 1 ? `+${order.order_items.length - 1} ${locale === 'es' ? 'más' : 'more'}` : ''}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between md:justify-end gap-10">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{t('tableColTotal')}</span>
                                        <span className="text-2xl font-black text-white italic tracking-tighter">
                                            {formatPrice(Number(order.total_amount), locale === 'es' ? 'es-SV' : 'en-US')}
                                        </span>
                                    </div>
                                    <button className="p-4 bg-slate-800 hover:bg-emerald-500 text-slate-400 hover:text-slate-900 rounded-2xl transition-all">
                                        <Eye className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {recentOrders.length === 0 && (
                            <div className="p-20 text-center bg-slate-900/30 rounded-[3rem] border border-dashed border-slate-800">
                                <ShoppingBag className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                                <p className="text-slate-500 font-black uppercase tracking-widest text-xs">{t('noActivity')}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column - High Impact Business Intelligence Widgets */}
                <div className="space-y-8">
                    {/* Widget 1: Canales de Venta (Kiosko vs Exo Server) */}
                    <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[3rem] border border-slate-800">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black text-white italic tracking-tighter uppercase flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-emerald-500" />
                                {locale === 'es' ? 'Canales de Venta' : 'Sales Channels'}
                            </h3>
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                                {locale === 'es' ? 'Volumen Real' : 'Real Volume'}
                            </span>
                        </div>

                        {/* Visual Progress Bar (Multi-color) */}
                        <div className="h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 p-0.5 flex gap-1 mb-6">
                            <div
                                className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-700"
                                style={{ width: `${Math.max(channelStats.kioskPercent, 5)}%` }}
                                title={`Kiosko: ${channelStats.kioskPercent}%`}
                            ></div>
                            <div
                                className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 rounded-full transition-all duration-700"
                                style={{ width: `${Math.max(channelStats.exoPercent, 5)}%` }}
                                title={`Exo Server: ${channelStats.exoPercent}%`}
                            ></div>
                        </div>

                        {/* Channels Breakdown Cards */}
                        <div className="space-y-3">
                            {/* Kiosk Channel */}
                            <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl">
                                        <Monitor className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white">{locale === 'es' ? 'Kiosko Autoservicio' : 'Self-Service Kiosk'}</p>
                                        <p className="text-[9px] font-bold text-slate-500">{channelStats.kioskOrders} {locale === 'es' ? 'órdenes' : 'orders'} ({channelStats.kioskPercent}%)</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-base font-black text-white italic tracking-tighter">
                                        {formatPrice(channelStats.kioskSales, locale === 'es' ? 'es-SV' : 'en-US')}
                                    </p>
                                </div>
                            </div>

                            {/* Exo Server Channel */}
                            <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl">
                                        <Smartphone className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white">Exo Server (Meseras)</p>
                                        <p className="text-[9px] font-bold text-slate-500">{channelStats.exoOrders} {locale === 'es' ? 'órdenes' : 'orders'} ({channelStats.exoPercent}%)</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-base font-black text-white italic tracking-tighter">
                                        {formatPrice(channelStats.exoSales, locale === 'es' ? 'es-SV' : 'en-US')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Widget 2: Top Platillos Más Vendidos (Ranking del Menú) */}
                    <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[3rem] border border-slate-800">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black text-white italic tracking-tighter uppercase flex items-center gap-2">
                                <Flame className="w-5 h-5 text-orange-500" />
                                {locale === 'es' ? 'Platos Más Vendidos' : 'Best Sellers'}
                            </h3>
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                                TOP 5
                            </span>
                        </div>

                        {topDishes.length === 0 ? (
                            <div className="py-8 text-center text-slate-500">
                                <Utensils className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                                <p className="text-[10px] font-black uppercase tracking-widest">{locale === 'es' ? 'Sin datos de platos aún' : 'No dish data yet'}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {topDishes.map((dish, idx) => {
                                    const maxQty = topDishes[0]?.quantity || 1;
                                    const percent = Math.round((dish.quantity / maxQty) * 100);
                                    const dishName = getLocalizedValue(dish.name, locale) || (locale === 'es' ? 'Plato Especial' : 'Special Dish');

                                    return (
                                        <div key={dish.id || idx} className="p-3.5 bg-slate-950/40 border border-slate-800/80 rounded-2xl space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2.5">
                                                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${
                                                        idx === 0 ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' :
                                                        idx === 1 ? 'bg-slate-300 text-slate-950' :
                                                        idx === 2 ? 'bg-amber-700 text-white' :
                                                        'bg-slate-800 text-slate-400'
                                                    }`}>
                                                        #{idx + 1}
                                                    </span>
                                                    <div>
                                                        <p className="text-xs font-black text-white uppercase italic tracking-tight leading-none truncate max-w-[150px]">
                                                            {dishName}
                                                        </p>
                                                        <span className="text-[9px] font-bold text-slate-500">
                                                            {dish.quantity} {locale === 'es' ? 'vendidos' : 'sold'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="text-xs font-black text-emerald-400 italic">
                                                    {formatPrice(dish.revenue, locale === 'es' ? 'es-SV' : 'en-US')}
                                                </span>
                                            </div>
                                            <div className="h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                                                    style={{ width: `${percent}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Widget 3: Rendimiento de Meseras (si hay comandas en sala) o Tip Operativo */}
                    {topWaitresses.length > 0 ? (
                        <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[3rem] border border-slate-800">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-black text-white italic tracking-tighter uppercase flex items-center gap-2">
                                    <Award className="w-5 h-5 text-indigo-400" />
                                    {locale === 'es' ? 'Rendimiento Meseras' : 'Waitress Performance'}
                                </h3>
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                                    EXO SERVER
                                </span>
                            </div>

                            <div className="space-y-2.5">
                                {topWaitresses.map((w, idx) => (
                                    <div key={idx} className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-2xl flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-black text-[10px]">
                                                {w.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-white">{w.name}</p>
                                                <p className="text-[9px] font-bold text-slate-500">{w.ordersCount} {locale === 'es' ? 'comandas tomadas' : 'orders taken'}</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-black text-white italic">
                                            {formatPrice(w.sales, locale === 'es' ? 'es-SV' : 'en-US')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 bg-emerald-500/5 rounded-[2.5rem] border border-emerald-500/10">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-[0_10px_20px_rgba(16,185,129,0.2)]">
                                    <Sparkles className="w-6 h-6 text-slate-900" />
                                </div>
                                <div>
                                    <p className="text-emerald-500 font-black uppercase tracking-widest text-[10px]">{t('tipOfTheDay')}</p>
                                    <p className="text-slate-300 text-xs font-bold leading-tight mt-1">
                                        {t('tipMessage')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Order Details Modal Redesigned */}
            {selectedOrder && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 w-full max-w-2xl rounded-[3rem] border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 flex justify-between items-start border-b border-slate-800/50">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-emerald-500 rounded-3xl flex flex-col items-center justify-center shadow-[0_10px_30px_rgba(16,185,129,0.3)]">
                                    <span className="text-[10px] font-black text-slate-900 uppercase">{t('tableColOrder') || 'Orden'}</span>
                                    <span className="text-2xl font-black text-slate-900 tracking-tighter">{selectedOrder.order_number}</span>
                                </div>
                                <div>
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">{t('orderDetails')}</h2>
                                        {(() => {
                                            const isExo = selectedOrder.source === 'exo_server' || selectedOrder.source === 'exo_server_closed' || Boolean(selectedOrder.waitress_id || selectedOrder.waitress || selectedOrder.table_id || selectedOrder.table);
                                            return isExo ? (
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                                    <Smartphone className="w-3 h-3" />
                                                    Exo Server
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                    <Monitor className="w-3 h-3" />
                                                    {locale === 'es' ? 'Kiosko' : 'Kiosk'}
                                                </span>
                                            );
                                        })()}
                                        {(selectedOrder.table?.number || selectedOrder.tables?.number) && (
                                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                {locale === 'es' ? `Mesa #${selectedOrder.table?.number || selectedOrder.tables?.number}` : `Table #${selectedOrder.table?.number || selectedOrder.tables?.number}`}
                                            </span>
                                        )}
                                        {selectedOrder.waitress?.full_name && (
                                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                                {locale === 'es' ? `Mesera: ${selectedOrder.waitress.full_name}` : `Waitress: ${selectedOrder.waitress.full_name}`}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-slate-500 font-bold text-sm">
                                        {t('processedOn', {
                                            date: mounted ? new Date(selectedOrder.created_at).toLocaleDateString(locale === 'es' ? 'es-SV' : 'en-US') : '',
                                            time: mounted ? new Date(selectedOrder.created_at).toLocaleTimeString(locale === 'es' ? 'es-SV' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : ''
                                        })}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="p-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl transition-all"
                            >
                                <CloseIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-8 max-h-[50vh] overflow-y-auto custom-scrollbar space-y-4">
                            {selectedOrder.order_items.map((item: any) => (
                                <div key={item.id} className="flex gap-6 p-6 bg-slate-950/50 rounded-[2rem] border border-slate-800/50">
                                    <div className="w-12 h-12 bg-slate-800 text-white rounded-2xl flex items-center justify-center font-black text-xl border border-slate-700">
                                        {item.quantity}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">
                                                {getLocalizedValue(item.products?.name, locale) || (locale === 'es' ? 'Plato' : 'Dish')}
                                            </h3>
                                            <span className="font-black text-emerald-500 text-lg">
                                                {formatPrice(Number(item.unit_price) * item.quantity, locale === 'es' ? 'es-SV' : 'en-US')}
                                            </span>
                                        </div>
                                        {item.modifiers_json && (
                                            <div className="flex flex-wrap gap-2">
                                                {item.modifiers_json.map((mod: any, idx: number) => (
                                                    <span key={idx} className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-800 px-2 py-1 rounded-lg">
                                                        {mod.options.map((o: any) => o.name).join(', ')}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-8 bg-slate-950/50 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-8">
                            <div className="text-center md:text-left">
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">{t('finalTotal')}</p>
                                <p className="text-4xl font-black text-white italic tracking-tighter">{formatPrice(Number(selectedOrder.total_amount), locale === 'es' ? 'es-SV' : 'en-US')}</p>
                            </div>
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="w-full md:w-auto px-12 py-5 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-[2rem] font-black uppercase tracking-widest transition-all active:scale-95 shadow-[0_10px_30px_rgba(16,185,129,0.3)]"
                            >
                                {t('gotIt')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ icon, label, value, trend, color, delay }: { icon: React.ReactNode, label: string, value: string, trend?: string, color: string, delay: string }) {
    const colorClasses: Record<string, string> = {
        emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    };

    const iconBg: Record<string, string> = {
        emerald: 'bg-emerald-500 text-slate-900',
        amber: 'bg-amber-500 text-slate-900',
        blue: 'bg-blue-500 text-white',
        purple: 'bg-purple-500 text-white',
    };

    return (
        <div className={`bg-slate-900/50 backdrop-blur-xl p-8 rounded-[3rem] border border-slate-800 hover:border-slate-700 transition-all group animate-in slide-in-from-bottom duration-500 ${delay}`}>
            <div className="flex justify-between items-start mb-6">
                <div className={`p-4 rounded-2xl transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6 ${iconBg[color]}`}>
                    {icon}
                </div>
                {trend && (
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${colorClasses[color]}`}>
                        {trend}
                    </span>
                )}
            </div>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1 italic">{label}</p>
            <h3 className="text-3xl font-black text-white tracking-tighter">{value}</h3>
        </div>
    );
}
