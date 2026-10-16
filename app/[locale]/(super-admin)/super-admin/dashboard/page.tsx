import { getAdminClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/auth/guards';
import {
    Building2,
    ShoppingBag,
    TrendingUp,
    ArrowUpRight,
    ArrowDownRight,
    Plus,
    Activity,
    Server,
    Zap
} from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { Link } from '@/i18n/routing';

export default async function SuperAdminDashboard() {
    await requireSuperAdmin();
    const supabase = getAdminClient();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let stats = {
        totalRestaurants: 0,
        activeRestaurants: 0,
        totalOrdersToday: 0,
        totalRevenue: 0
    };

    try {
        const [restaurantsRes, activeRes, ordersTodayRes] = await Promise.all([
            (supabase.from('restaurants') as any).select('*', { count: 'exact', head: true }),
            (supabase.from('restaurants').select('*', { count: 'exact', head: true }).eq('is_active', true) as any),
            (supabase.from('orders').select('total_amount').gte('created_at', today.toISOString()) as any)
        ]);

        stats = {
            totalRestaurants: restaurantsRes.count || 0,
            activeRestaurants: activeRes.count || 0,
            totalOrdersToday: (ordersTodayRes.data as any[])?.length || 0,
            totalRevenue: (ordersTodayRes.data as any[])?.reduce((acc: number, order: any) => acc + Number(order.total_amount), 0) || 0
        };
    } catch (err) {
        console.warn('SuperAdminDashboard: Database fetch skipped/failed (offline/network issue):', err);
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-8 h-1 bg-emerald-500 rounded-full"></span>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Central de Mando</span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        Super Admin Dashboard
                    </h1>
                </div>
                <Link
                    href="/super-admin/restaurants"
                    className="group relative flex items-center justify-center gap-3 px-10 py-5 bg-emerald-500 text-slate-900 rounded-[2rem] font-black uppercase tracking-widest shadow-[0_10px_25px_rgba(16,185,129,0.3)] hover:-translate-y-1 transition-all active:scale-95 whitespace-nowrap"
                >
                    <Plus className="w-6 h-6" />
                    <span>Nuevo Restaurante</span>
                </Link>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <SuperStatCard
                    icon={<Building2 className="w-6 h-6" />}
                    label="Restaurantes"
                    value={stats.totalRestaurants.toString()}
                    subValue={`${stats.activeRestaurants} ACTIVOS`}
                    color="emerald"
                    delay="delay-[100ms]"
                />
                <SuperStatCard
                    icon={<Activity className="w-6 h-6" />}
                    label="Órdenes Hoy"
                    value={stats.totalOrdersToday.toString()}
                    trend="+14%"
                    trendType="up"
                    color="blue"
                    delay="delay-[200ms]"
                />
                <SuperStatCard
                    icon={<TrendingUp className="w-6 h-6" />}
                    label="Ingresos Hoy"
                    value={formatPrice(stats.totalRevenue, 'es-SV')}
                    trend="+8%"
                    trendType="up"
                    color="amber"
                    delay="delay-[300ms]"
                />
                <SuperStatCard
                    icon={<ShoppingBag className="w-6 h-6" />}
                    label="Crecimiento"
                    value="2.4%"
                    trend="-1%"
                    trendType="down"
                    color="purple"
                    delay="delay-[400ms]"
                />
            </div>

            {/* Network Health */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-900/50 backdrop-blur-xl p-8 lg:p-12 rounded-[3.5rem] border border-slate-800 hover:border-slate-700 transition-all shadow-2xl">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center text-slate-900 shadow-[0_10px_20px_rgba(16,185,129,0.3)]">
                            <Server className="w-7 h-7" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">Red & Servidores</h2>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Estado en tiempo real</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-6 p-6 bg-slate-900/80 hover:bg-slate-800 rounded-[2rem] border border-slate-800 transition-all cursor-pointer group">
                                <div className="w-14 h-14 rounded-2xl bg-slate-950 flex items-center justify-center text-slate-600 font-black group-hover:text-emerald-500 transition-all border border-slate-800 group-hover:border-emerald-500/30">
                                    0{i}
                                </div>
                                <div className="flex-1">
                                    <p className="font-black text-white text-lg italic tracking-tighter uppercase group-hover:text-emerald-500 transition-colors">Servidor Central {i}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Zap className="w-3 h-3 text-amber-500" />
                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Latencia 24ms</p>
                                    </div>
                                </div>
                                <div className="w-4 h-4 bg-emerald-500/20 rounded-full flex items-center justify-center">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-slate-900 p-10 lg:p-14 rounded-[3.5rem] text-white overflow-hidden relative group border border-slate-800">
                    <div className="relative z-10 h-full flex flex-col justify-center">
                        <h2 className="text-5xl lg:text-7xl font-black tracking-tighter uppercase italic leading-none text-emerald-500 mb-6 drop-shadow-2xl">
                            CONTROL<br />TOTAL.
                        </h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] max-w-sm leading-relaxed border-l-2 border-emerald-500/50 pl-4">
                            ADMINISTRA LA FACTURACIÓN, LOS PLANES Y EL ACCESO DE CADA UNO DE TUS CLIENTES DESDE UN SOLO LUGAR DE FORMA CENTRALIZADA.
                        </p>
                    </div>
                    <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-emerald-500/10 blur-[100px] rounded-full group-hover:bg-emerald-500/20 transition-all duration-700"></div>
                    <Activity className="absolute -bottom-10 -right-10 w-64 h-64 text-slate-800/30 rotate-12 group-hover:scale-110 group-hover:text-slate-800/50 transition-all duration-700" />
                </div>
            </div>
        </div>
    );
}

function SuperStatCard({ icon, label, value, subValue, trend, trendType, color, delay }: any) {
    const colorClasses: Record<string, string> = {
        emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
        rose: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    };

    const iconBg: Record<string, string> = {
        emerald: 'bg-emerald-500 text-slate-900',
        amber: 'bg-amber-500 text-slate-900',
        blue: 'bg-blue-500 text-slate-900',
        purple: 'bg-purple-500 text-white',
        rose: 'bg-rose-500 text-white',
    };

    return (
        <div className={`bg-slate-900/50 backdrop-blur-xl p-8 rounded-[3rem] border border-slate-800 hover:border-slate-700 transition-all group animate-in slide-in-from-bottom shadow-2xl ${delay}`}>
            <div className="flex justify-between items-start mb-8">
                <div className={`p-5 rounded-2xl transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6 ${iconBg[color]}`}>
                    {icon}
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${trendType === 'up'
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        }`}>
                        {trendType === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {trend}
                    </div>
                )}
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">{label}</p>
            <h3 className="text-4xl lg:text-5xl font-black text-white italic tracking-tighter uppercase mb-2 group-hover:text-emerald-500 transition-colors drop-shadow-md">{value}</h3>
            {subValue && (
                <div className="flex items-center gap-2 mt-4">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{subValue}</p>
                </div>
            )}
        </div>
    );
}
