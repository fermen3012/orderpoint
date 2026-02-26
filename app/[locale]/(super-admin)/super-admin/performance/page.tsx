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
        <div className="space-y-10 animate-in fade-in duration-700 w-full overflow-hidden">
            {/* Header section matches page.tsx style */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-8 h-1 bg-emerald-500 rounded-full"></span>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Gestión Global</span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        Rendimiento
                    </h1>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-6 w-full xl:w-auto">
                    <RefreshButton />
                </div>
            </div>

            {/* Grid de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Latencia DB */}
                <div className={cn(
                    "relative overflow-hidden p-8 rounded-[3rem] border border-slate-800 transition-all hover:shadow-2xl hover:-translate-y-1 group",
                    isLatencyHigh
                        ? "bg-rose-500/5 shadow-rose-500/10"
                        : "bg-slate-900/40 backdrop-blur-sm"
                )}>
                    <div className={cn(
                        "absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500",
                        isLatencyHigh ? "text-rose-500" : "text-emerald-500"
                    )}>
                        <Zap className="w-24 h-24" />
                    </div>

                    <div className="relative z-10 space-y-6 flex flex-col h-full justify-between">
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "p-4 rounded-[1.25rem] border shadow-inner flex items-center justify-center",
                                isLatencyHigh ? "bg-rose-500/20 text-rose-500 border-rose-500/30" : "bg-emerald-500/20 text-emerald-500 border-emerald-500/30"
                            )}>
                                <Zap className="w-6 h-6" />
                            </div>
                            <span className="font-black text-white text-lg uppercase tracking-widest italic text-center leading-none mt-2">Latencia DB</span>
                        </div>

                        <div>
                            <span className={cn(
                                "text-6xl font-black tracking-tighter italic leading-none block",
                                isLatencyHigh ? "text-rose-500" : "text-emerald-500"
                            )}>
                                {dbLatency}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">MS</span>
                        </div>

                        <div className="flex items-center gap-2 mt-4">
                            <div className={cn(
                                "w-3 h-3 rounded-full animate-pulse",
                                isLatencyHigh ? "bg-rose-500" : "bg-emerald-500"
                            )} />
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                                {isLatencyHigh ? 'Rendimiento Extremo' : 'Rendimiento Óptimo'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Estado API / Carga */}
                <div className="relative overflow-hidden p-8 rounded-[3rem] border border-slate-800 bg-slate-900/40 backdrop-blur-sm transition-all hover:shadow-2xl hover:-translate-y-1 group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 text-slate-500 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
                        <Database className="w-24 h-24" />
                    </div>

                    <div className="relative z-10 space-y-6 flex flex-col h-full justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-slate-800 rounded-[1.25rem] border border-slate-700 text-slate-400 flex items-center justify-center">
                                <Database className="w-6 h-6" />
                            </div>
                            <span className="font-black text-white text-lg uppercase tracking-widest italic text-center leading-none mt-2">Estado API</span>
                        </div>

                        <div>
                            <span className="text-5xl font-black text-white tracking-tighter italic leading-none block uppercase">
                                {dbStatus}
                            </span>
                        </div>

                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 leading-relaxed mt-4">
                            Conteo: <span className="text-emerald-500">{dataLatency}ms</span> para <span className="text-white">{count}</span> reg.
                        </p>
                    </div>
                </div>

                {/* Región Servidor */}
                <div className="relative overflow-hidden p-8 rounded-[3rem] border border-slate-800 bg-slate-950 backdrop-blur-sm border-t-emerald-500/30 transition-all hover:shadow-2xl hover:-translate-y-1 group">
                    <div className="absolute top-0 right-0 p-6 opacity-5 text-emerald-500 group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-500">
                        <Globe className="w-32 h-32" />
                    </div>

                    <div className="relative z-10 space-y-6 flex flex-col h-full justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-emerald-500/10 rounded-[1.25rem] border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
                                <Server className="w-6 h-6" />
                            </div>
                            <span className="font-black text-white text-lg uppercase tracking-widest italic text-center leading-none mt-2">Host</span>
                        </div>

                        <div>
                            <span className="text-4xl font-black text-white uppercase tracking-tighter italic leading-none block">
                                {region}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 mt-4 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl w-max">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                                {isVercel ? 'Vercel Edge Network' : 'Entorno Local'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Subsección de Detalles */}
            <div className="bg-slate-900/50 backdrop-blur-md p-10 rounded-[3.5rem] border border-slate-800 space-y-8">
                <div className="flex items-center justify-between border-b border-slate-800 pb-6">
                    <div>
                        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Detalles de Conexión</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Logs crudos del host virtual</p>
                    </div>
                    <div className="hidden sm:flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 text-slate-500">
                        <Activity className="w-5 h-5" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] font-bold uppercase tracking-widest font-mono text-slate-400 bg-slate-950 p-6 md:p-8 rounded-[2rem] border border-slate-800">
                    <div className="flex justify-between items-center border-b border-slate-800/50 pb-4">
                        <span>Database Engine //</span>
                        <span className="text-emerald-500">PostgreSQL (Supabase)</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-800/50 pb-4">
                        <span>Next.js Version //</span>
                        <span className="text-blue-500">15.1.0</span>
                    </div>
                    <div className="flex justify-between items-center border-b md:border-b-0 md:border-r-0 border-slate-800/50 pb-4 md:pb-0 pt-4 md:pt-0">
                        <span>Server Timestamp //</span>
                        <span className="text-white normal-case">{new Date().toISOString()}</span>
                    </div>
                    <div className="flex justify-between items-center pt-4 md:pt-0">
                        <span>Request Protocol //</span>
                        <span className="text-amber-500">HTTPS/Edge</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
