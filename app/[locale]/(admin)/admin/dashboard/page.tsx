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
    X as CloseIcon
} from 'lucide-react';
import { formatPrice } from '@/lib/utils';

import { useAuth } from '@/components/auth/AuthContext';

export default function DashboardPage() {
    const t = useTranslations('admin');
    const locale = useLocale();
    const router = useRouter();
    const { restaurantId } = useAuth();
    
    const parseLocalizedField = (field: any): { es: string; en: string } => {
        if (!field) return { es: '', en: '' };
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
            } else {
                break;
            }
        }
        
        if (current && typeof current === 'object') {
            const es = current.es || current.ES || current.Es || '';
            const en = current.en || current.EN || current.En || es || '';
            return {
                es: typeof es === 'string' ? es : String(es),
                en: typeof en === 'string' ? en : String(en)
            };
        }
        
        const val = typeof current === 'string' ? current : String(current);
        return { es: val, en: val };
    };
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalSales: 0,
        totalOrders: 0,
        activeProducts: 0,
        categories: 0
    });
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
                    .select('*, order_items(*, products(name))')
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
                const totalSales = orders.reduce((acc, order) => acc + Number(order.total_amount), 0);
                setStats({
                    totalSales,
                    totalOrders: orders.length,
                    activeProducts: productsRes.count || 0,
                    categories: categoriesRes.count || 0
                });

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

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    icon={<TrendingUp className="w-6 h-6" />}
                    label={t('totalSales')}
                    value={formatPrice(stats.totalSales, locale === 'es' ? 'es-SV' : 'en-US')}
                    trend="+12.5%"
                    color="emerald"
                    delay="delay-[100ms]"
                />
                <StatCard
                    icon={<ShoppingBag className="w-6 h-6" />}
                    label={t('totalOrders')}
                    value={stats.totalOrders.toString()}
                    trend="+5.2%"
                    color="amber"
                    delay="delay-[200ms]"
                />
                <StatCard
                    icon={<Package className="w-6 h-6" />}
                    label={t('products')}
                    value={stats.activeProducts.toString()}
                    color="blue"
                    delay="delay-[300ms]"
                />
                <StatCard
                    icon={<Users className="w-6 h-6" />}
                    label={t('categories')}
                    value={stats.categories.toString()}
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
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${order.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                                                order.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                                                    'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                                }`}>
                                                {t(`status${order.status.charAt(0).toUpperCase() + order.status.slice(1)}` as any) || order.status}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-500">
                                                {mounted ? new Date(order.created_at).toLocaleTimeString(locale === 'es' ? 'es-SV' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                        </div>
                                        <p className="text-slate-400 font-bold text-sm">
                                            {parseLocalizedField(order.order_items?.[0]?.products?.name)[locale as 'es' | 'en'] || parseLocalizedField(order.order_items?.[0]?.products?.name).es} {order.order_items?.length > 1 ? `+${order.order_items.length - 1} ${locale === 'es' ? 'más' : 'more'}` : ''}
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

                {/* Right Column - Quick Stats / Activity */}
                <div className="space-y-8">
                    <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[3rem] border border-slate-800 h-full">
                        <h3 className="text-xl font-black text-white italic tracking-tighter uppercase mb-8">{t('performance')}</h3>

                        <div className="space-y-8">
                            <div className="space-y-3">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-slate-500">{t('kitchenCapacity')}</span>
                                    <span className="text-emerald-500">85%</span>
                                </div>
                                <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 p-0.5">
                                    <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full" style={{ width: '85%' }}></div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-slate-500">{t('tableEfficiency')}</span>
                                    <span className="text-amber-500">62%</span>
                                </div>
                                <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 p-0.5">
                                    <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full" style={{ width: '62%' }}></div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 p-6 bg-emerald-500/5 rounded-[2rem] border border-emerald-500/10">
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
                    </div>
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
                                    <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-1">{t('orderDetails')}</h2>
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
                                                {parseLocalizedField(item.products?.name)[locale as 'es' | 'en'] || parseLocalizedField(item.products?.name).es}
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
