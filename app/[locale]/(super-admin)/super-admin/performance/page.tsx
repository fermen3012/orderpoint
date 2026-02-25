import { createClient } from '@/lib/supabase/server';
import { Activity, Database, Globe, Zap, Server, ChevronRight } from 'lucide-react';
import { RefreshButton } from './RefreshButton';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PerformancePage() {
    const supabase = await createClient();

    // 1. Latency Ping (Simple Query)
    const t0 = performance.now();
    const { error: pingError } = await (supabase.from('restaurants') as any).select('id').limit(1);
    const t1 = performance.now();
    const dbLatency = Math.round(t1 - t0);

    // 2. Heavy Query (Data Load / Count)
    const t2 = performance.now();
    const { count, error: countError } = await (supabase
        .from('restaurants') as any)
        .select('*', { count: 'exact', head: true });
    const t3 = performance.now();
    const dataLatency = Math.round(t3 - t2);

    // 3. Region Detection
    const region = process.env.VERCEL_REGION || 'local-dev-1';
    const isVercel = !!process.env.VERCEL;

    // UI Logic
    const isLatencyHigh = dbLatency > 500;
    const dbStatus = pingError ? 'Offline' : 'Online';

    return (
        <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-secondary-900 tracking-tight flex items-center gap-3">
                        <Activity className="w-10 h-10 text-primary-500" />
                        Salud del Sistema
                    </h1>
                    <p className="text-secondary-500 font-medium mt-2">
                        Monitoreo en tiempo real de la infraestructura y base de datos.
                    </p>
                </div>
                <RefreshButton />
            </div>

            {/* Grid de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Tarjeta 1: Latencia DB */}
                <div className={cn(
                    "relative overflow-hidden p-8 rounded-[2.5rem] border-2 transition-all hover:shadow-2xl hover:-translate-y-1",
                    isLatencyHigh
                        ? "bg-red-50 border-red-100 shadow-red-100/50"
                        : "bg-white border-secondary-100 shadow-secondary-100/20"
                )}>
                    <div className={cn(
                        "absolute top-0 right-0 p-4 opacity-10",
                        isLatencyHigh ? "text-red-500" : "text-primary-500"
                    )}>
                        <Zap className="w-24 h-24" />
                    </div>

                    <div className="relative z-10 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "p-3 rounded-2xl",
                                isLatencyHigh ? "bg-red-500 text-white" : "bg-primary-500 text-white"
                            )}>
                                <Zap className="w-6 h-6" />
                            </div>
                            <span className="font-bold text-secondary-900">Latencia DB</span>
                        </div>

                        <div>
                            <span className={cn(
                                "text-5xl font-black",
                                isLatencyHigh ? "text-red-600" : "text-emerald-600"
                            )}>
                                {dbLatency}
                            </span>
                            <span className="text-xl font-bold text-secondary-500 ml-2">ms</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className={cn(
                                "w-3 h-3 rounded-full animate-pulse",
                                isLatencyHigh ? "bg-red-500" : "bg-emerald-500"
                            )} />
                            <p className="text-sm font-bold text-secondary-500 uppercase tracking-wider">
                                {isLatencyHigh ? 'Rendimiento Crítico' : 'Rendimiento Óptimo'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tarjeta 2: Estado API / Carga */}
                <div className="relative overflow-hidden p-8 rounded-[2.5rem] border-2 border-secondary-100 bg-white shadow-xl shadow-secondary-100/20 transition-all hover:shadow-2xl hover:-translate-y-1">
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-secondary-500">
                        <Database className="w-24 h-24" />
                    </div>

                    <div className="relative z-10 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-secondary-900 rounded-2xl text-white">
                                <Database className="w-6 h-6" />
                            </div>
                            <span className="font-bold text-secondary-900">Estado API</span>
                        </div>

                        <div>
                            <span className="text-5xl font-black text-secondary-900">
                                {dbStatus}
                            </span>
                        </div>

                        <p className="text-sm font-medium text-secondary-500 leading-relaxed">
                            Respuesta de conteo: <span className="font-bold text-secondary-900">{dataLatency}ms</span> para <span className="font-bold text-secondary-900">{count}</span> registros.
                        </p>
                    </div>
                </div>

                {/* Tarjeta 3: Región Servidor */}
                <div className="relative overflow-hidden p-8 rounded-[2.5rem] border-2 border-secondary-100 bg-white shadow-xl shadow-secondary-100/20 transition-all hover:shadow-2xl hover:-translate-y-1 text-white bg-gradient-to-br from-secondary-900 via-secondary-800 to-black">
                    <div className="absolute top-0 right-0 p-4 opacity-20 text-white">
                        <Globe className="w-24 h-24" />
                    </div>

                    <div className="relative z-10 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl text-white border border-white/20">
                                <Server className="w-6 h-6" />
                            </div>
                            <span className="font-bold text-white/80">Infraestructura</span>
                        </div>

                        <div>
                            <span className="text-4xl font-black text-white uppercase tracking-tight">
                                {region}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/10 w-max">
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/60">
                                {isVercel ? 'Vercel Edge Network' : 'Entorno Local'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Subsección de Detalles */}
            <div className="bg-secondary-50 p-8 sm:p-10 rounded-[3rem] border border-secondary-100 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black text-secondary-900">Detalles de Conectividad</h2>
                    <div className="flex items-center gap-2 text-primary-500 font-bold text-sm">
                        <span>Ver logs completos</span>
                        <ChevronRight className="w-4 h-4" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-mono text-secondary-600 bg-white p-6 rounded-3xl border border-secondary-100">
                    <div className="flex justify-between border-b border-secondary-50 pb-2">
                        <span className="font-bold">Database Engine:</span>
                        <span>PostgreSQL (Supabase)</span>
                    </div>
                    <div className="flex justify-between border-b border-secondary-50 pb-2">
                        <span className="font-bold">Next.js Version:</span>
                        <span>15.1.0</span>
                    </div>
                    <div className="flex justify-between border-b border-secondary-50 pb-2">
                        <span className="font-bold">Server Timestamp:</span>
                        <span>{new Date().toISOString()}</span>
                    </div>
                    <div className="flex justify-between border-b border-secondary-50 pb-2">
                        <span className="font-bold">Request Protocol:</span>
                        <span>HTTPS/Edge</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
