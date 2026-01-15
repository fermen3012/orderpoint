'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { adminSupabase } from '@/lib/supabase/admin-client';
import { useRouter } from '@/i18n/routing';
import {
    LayoutDashboard,
    ShoppingBag,
    Users,
    TrendingUp,
    LogOut,
    Package,
    List
} from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { Clock, Eye, X as CloseIcon } from 'lucide-react';

import { useAuth } from '@/components/auth/AuthContext';
import { SidebarLink } from '@/components/admin/SidebarLink';

export default function DashboardPage() {
    const t = useTranslations('admin');
    const router = useRouter();
    const { restaurantId } = useAuth();
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
                adminSupabase.from('orders')
                    .select('*, order_items(*, products(name))')
                    .eq('restaurant_id', restaurantId),
                adminSupabase.from('products')
                    .select('*', { count: 'exact', head: true })
                    .eq('restaurant_id', restaurantId),
                adminSupabase.from('categories')
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
        await adminSupabase.auth.signOut();
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
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 lg:p-10">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 animate-slide-up">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-secondary-900 tracking-tight">{t('dashboard')}</h1>
                    <p className="text-secondary-500 font-bold mt-1 text-sm md:text-base">Bienvenido de nuevo al panel de control.</p>
                </div>
                <div className="flex items-center gap-4 bg-white p-2 rounded-[2rem] shadow-sm border border-secondary-100 w-full md:w-auto">
                    <div className="flex items-center gap-3 px-4 py-2 bg-accent-50 rounded-[1.5rem] border border-accent-100 flex-1 md:flex-none justify-center md:justify-start">
                        <div className="w-2 h-2 bg-accent-500 rounded-full animate-pulse shadow-lg shadow-accent-500/50"></div>
                        <span className="text-[10px] md:text-xs font-black text-accent-700 uppercase tracking-widest">Sistema Online</span>
                    </div>
                </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 mb-10">
                <StatCard
                    icon={<TrendingUp className="w-6 h-6 text-primary-600" />}
                    label="Ventas Totales"
                    value={formatPrice(stats.totalSales, 'es-SV')}
                    trend="+12.5%"
                    bgColor="bg-primary-50"
                    delay="100ms"
                />
                <StatCard
                    icon={<ShoppingBag className="w-6 h-6 text-secondary-600" />}
                    label="Pedidos Totales"
                    value={stats.totalOrders.toString()}
                    trend="+5.2%"
                    bgColor="bg-secondary-50"
                    delay="200ms"
                />
                <StatCard
                    icon={<Package className="w-6 h-6 text-accent-600" />}
                    label="Productos"
                    value={stats.activeProducts.toString()}
                    bgColor="bg-accent-50"
                    delay="300ms"
                />
                <StatCard
                    icon={<Users className="w-6 h-6 text-blue-600" />}
                    label="Categorías"
                    value={stats.categories.toString()}
                    bgColor="bg-blue-50"
                    delay="400ms"
                />
            </div>

            {/* Recent Orders */}
            <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-xl shadow-secondary-900/5 border border-secondary-100 overflow-hidden animate-slide-up" style={{ animationDelay: '500ms' }}>
                <div className="p-6 md:p-8 border-b border-secondary-50 flex justify-between items-center">
                    <h2 className="text-xl md:text-2xl font-black text-secondary-900 tracking-tight">Pedidos Recientes</h2>
                    <button className="bg-secondary-50 text-secondary-600 px-4 md:px-6 py-2 rounded-xl md:rounded-2xl font-black text-xs md:text-sm hover:bg-primary-500 hover:text-white transition-all duration-300">
                        Ver todos
                    </button>
                </div>
                <div className="overflow-x-auto min-w-full">
                    <table className="w-full text-left min-w-[800px] md:min-w-0">
                        <thead className="bg-secondary-50/50 text-secondary-400 text-[10px] md:text-xs uppercase font-black tracking-widest">
                            <tr>
                                <th className="px-6 md:px-8 py-4 md:py-5">Orden</th>
                                <th className="px-6 md:px-8 py-4 md:py-5">Fecha</th>
                                <th className="px-6 md:px-8 py-4 md:py-5">Estado</th>
                                <th className="px-6 md:px-8 py-4 md:py-5">Tiempo Prep.</th>
                                <th className="px-6 md:px-8 py-4 md:py-5 text-right">Total</th>
                                <th className="px-6 md:px-8 py-4 md:py-5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary-50">
                            {recentOrders.map((order) => (
                                <tr key={order.id} className="hover:bg-secondary-50/30 transition-colors group">
                                    <td className="px-6 md:px-8 py-4 md:py-6 font-black text-secondary-900">#{order.order_number}</td>
                                    <td className="px-6 md:px-8 py-4 md:py-6 text-secondary-500 font-bold text-sm">
                                        {mounted ? new Date(order.created_at).toLocaleDateString('es-SV', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        }) : ''}
                                    </td>
                                    <td className="px-6 md:px-8 py-4 md:py-6">
                                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${order.status === 'completed' ? 'bg-accent-100 text-accent-700' :
                                            order.status === 'pending' ? 'bg-primary-100 text-primary-700' :
                                                'bg-blue-100 text-blue-700'
                                            }`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="px-6 md:px-8 py-4 md:py-6">
                                        {order.ready_at ? (
                                            <div className="flex items-center gap-2 text-secondary-500 font-bold text-sm">
                                                <Clock className="w-4 h-4 text-accent-500" />
                                                <span>{calculateTime(order.created_at, order.ready_at)}</span>
                                            </div>
                                        ) : (
                                            <span className="text-secondary-300 text-[10px] md:text-xs font-bold italic">En proceso...</span>
                                        )}
                                    </td>
                                    <td className="px-6 md:px-8 py-4 md:py-6 text-right font-black text-primary-600 text-base md:text-lg">
                                        {formatPrice(Number(order.total_amount), 'es-SV')}
                                    </td>
                                    <td className="px-6 md:px-8 py-4 md:py-6 text-right">
                                        <button
                                            onClick={() => setSelectedOrder(order)}
                                            className="p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-secondary-100 hover:shadow-sm"
                                        >
                                            <Eye className="w-5 h-5 text-secondary-400" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Order Details Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-secondary-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-2xl rounded-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden animate-scale-in">
                        <div className="p-6 md:p-8 border-b border-secondary-50 flex justify-between items-center bg-secondary-50/30">
                            <div>
                                <h2 className="text-2xl md:text-3xl font-black text-secondary-900 tracking-tight">Orden #{selectedOrder.order_number}</h2>
                                <p className="text-secondary-500 font-bold mt-1 text-sm">Detalles completos del pedido</p>
                            </div>
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="p-2 md:p-3 hover:bg-white rounded-xl md:rounded-2xl transition-all shadow-sm border border-secondary-100"
                            >
                                <CloseIcon className="w-5 h-5 md:w-6 md:h-6 text-secondary-400" />
                            </button>
                        </div>

                        <div className="p-6 md:p-8 max-h-[50vh] md:max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <div className="space-y-4 md:space-y-6">
                                {selectedOrder.order_items.map((item: any) => (
                                    <div key={item.id} className="flex gap-4 md:gap-6 p-4 md:p-6 bg-secondary-50/50 rounded-[1.5rem] md:rounded-[2rem] border border-secondary-100">
                                        <div className="w-10 h-10 md:w-14 md:h-14 bg-primary-500 text-white rounded-xl md:rounded-2xl flex items-center justify-center font-black text-lg md:text-xl shadow-lg shadow-primary-200 flex-shrink-0">
                                            {item.quantity}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 gap-1">
                                                <h3 className="text-lg md:text-xl font-black text-secondary-900 truncate">{item.products?.name}</h3>
                                                <span className="font-black text-primary-600 sm:text-lg">{formatPrice(Number(item.unit_price) * item.quantity, 'es-SV')}</span>
                                            </div>
                                            {item.modifiers_json && item.modifiers_json.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {item.modifiers_json.map((mod: any, idx: number) => (
                                                        <div key={idx} className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest bg-white px-2 py-0.5 rounded border border-secondary-100">
                                                            {mod.options.map((o: any) => o.name).join(', ')}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                                <div className="p-5 md:p-6 bg-blue-50 rounded-[1.5rem] md:rounded-[2rem] border border-blue-100">
                                    <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-1">Estado Actual</p>
                                    <p className="text-lg md:text-xl font-black text-blue-900 uppercase">{selectedOrder.status}</p>
                                </div>
                                <div className="p-5 md:p-6 bg-accent-50 rounded-[1.5rem] md:rounded-[2rem] border border-accent-100">
                                    <p className="text-accent-400 text-[10px] font-black uppercase tracking-widest mb-1">Tiempo de Preparación</p>
                                    <p className="text-lg md:text-xl font-black text-accent-900">
                                        {selectedOrder.ready_at ? calculateTime(selectedOrder.created_at, selectedOrder.ready_at) : 'En proceso'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 md:p-8 bg-secondary-50/30 border-t border-secondary-50 flex flex-col sm:flex-row justify-between items-center gap-6">
                            <div className="text-center sm:text-left">
                                <p className="text-secondary-400 text-xs font-black uppercase tracking-widest">Total del Pedido</p>
                                <p className="text-3xl md:text-4xl font-black text-secondary-900 tracking-tighter">{formatPrice(Number(selectedOrder.total_amount), 'es-SV')}</p>
                            </div>
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="w-full sm:w-auto px-10 py-4 bg-secondary-900 text-white rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-secondary-800 transition-all shadow-xl shadow-secondary-200 active:scale-95"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


function StatCard({ icon, label, value, trend, bgColor, delay }: { icon: React.ReactNode, label: string, value: string, trend?: string, bgColor: string, delay: string }) {
    return (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-secondary-900/5 border border-secondary-100 animate-scale-in group hover:-translate-y-1 transition-all duration-300" style={{ animationDelay: delay }}>
            <div className="flex justify-between items-start mb-6">
                <div className={`p-4 rounded-2xl ${bgColor} group-hover:scale-110 transition-transform duration-300`}>
                    {icon}
                </div>
                {trend && (
                    <span className="text-accent-600 text-[10px] font-black bg-accent-50 px-3 py-1 rounded-full border border-accent-100 uppercase tracking-widest">
                        {trend}
                    </span>
                )}
            </div>
            <p className="text-secondary-400 text-xs font-black uppercase tracking-widest mb-2">{label}</p>
            <h3 className="text-3xl font-black text-secondary-900 tracking-tighter">{value}</h3>
        </div>
    );
}
