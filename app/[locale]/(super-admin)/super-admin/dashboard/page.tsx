import { getAdminClient } from '@/lib/supabase/server';
import {
    Building2,
    ShoppingBag,
    TrendingUp,
    ArrowUpRight,
    ArrowDownRight,
    Plus,
    Activity
} from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { Link } from '@/i18n/routing';

export default async function SuperAdminDashboard() {
    const supabase = getAdminClient();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [restaurantsRes, activeRes, ordersTodayRes] = await Promise.all([
        supabase.from('restaurants').select('*', { count: 'exact', head: true }),
        (supabase.from('restaurants').select('*', { count: 'exact', head: true }).eq('is_active', true) as any),
        (supabase.from('orders').select('total_amount').gte('created_at', today.toISOString()) as any)
    ]);

    const stats = {
        totalRestaurants: restaurantsRes.count || 0,
        activeRestaurants: activeRes.count || 0,
        totalOrdersToday: (ordersTodayRes.data as any[])?.length || 0,
        totalRevenue: (ordersTodayRes.data as any[])?.reduce((acc: number, order: any) => acc + Number(order.total_amount), 0) || 0
    };

    return (
        <main className="flex-1 p-8 md:p-12 overflow-y-auto">
            {/* DEBUG: Dashboard Server Component Rendered */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Super Admin Dashboard</h1>
                    <p className="text-slate-500 font-bold mt-2 flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Resumen global de la plataforma OrderPoint
                    </p>
                </div>
                <Link
                    href="/super-admin/restaurants"
                    className="flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-2xl hover:bg-slate-800 transition-all active:scale-95 whitespace-nowrap"
                >
                    <Plus className="w-5 h-5" />
                    <span>Nuevo Restaurante</span>
                </Link>
            </header>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <SuperStatCard
                    icon={<Building2 className="w-6 h-6 text-indigo-600" />}
                    label="Restaurantes"
                    value={stats.totalRestaurants.toString()}
                    subValue={`${stats.activeRestaurants} activos`}
                    color="indigo"
                />
                <SuperStatCard
                    icon={<Activity className="w-6 h-6 text-green-600" />}
                    label="Órdenes Hoy"
                    value={stats.totalOrdersToday.toString()}
                    trend="+14%"
                    trendType="up"
                    color="green"
                />
                <SuperStatCard
                    icon={<TrendingUp className="w-6 h-6 text-amber-600" />}
                    label="Ingresos Hoy"
                    value={formatPrice(stats.totalRevenue, 'es-SV')}
                    trend="+8%"
                    trendType="up"
                    color="amber"
                />
                <SuperStatCard
                    icon={<ShoppingBag className="w-6 h-6 text-rose-600" />}
                    label="Tasa de Crecimiento"
                    value="2.4%"
                    trend="-1%"
                    trendType="down"
                    color="rose"
                />
            </div>

            {/* Network Health */}
            <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50">
                    <h2 className="text-2xl font-black text-slate-900 mb-6 tracking-tight">Estado de la Red</h2>
                    <div className="space-y-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all cursor-pointer group">
                                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-black group-hover:bg-primary-500 group-hover:text-white transition-all">
                                    {i}
                                </div>
                                <div className="flex-1">
                                    <p className="font-black text-slate-900">Servidor Región Central {i}</p>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Normal - Latencia 24ms</p>
                                </div>
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white overflow-hidden relative group">
                    <div className="relative z-10">
                        <h2 className="text-4xl font-black tracking-tighter mb-4">Control Total.</h2>
                        <p className="text-slate-400 font-bold max-w-xs mb-8">Administra la facturación, los planes y el acceso de cada uno de tus clientes desde un solo lugar.</p>
                    </div>
                    <Activity className="absolute -bottom-10 -right-10 w-64 h-64 text-slate-800 rotate-12 group-hover:scale-110 transition-transform duration-700" />
                </div>
            </div>
        </main>
    );
}

function SuperStatCard({ icon, label, value, subValue, trend, trendType, color }: any) {
    const colors: any = {
        indigo: 'bg-indigo-50 text-indigo-600',
        green: 'bg-green-50 text-green-600',
        amber: 'bg-amber-50 text-amber-600',
        rose: 'bg-rose-50 text-rose-600',
    };

    return (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300">
            <div className="flex justify-between items-start mb-6">
                <div className={`p-4 rounded-2xl ${colors[color]}`}>
                    {icon}
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${trendType === 'up' ? 'bg-green-50 text-green-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                        {trendType === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {trend}
                    </div>
                )}
            </div>
            <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">{label}</p>
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-1">{value}</h3>
            {subValue && <p className="text-xs text-slate-400 font-bold">{subValue}</p>}
        </div>
    );
}
