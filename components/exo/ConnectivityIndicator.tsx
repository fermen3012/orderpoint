'use client';

import { useEffect, useState } from 'react';
import { useExoCartStore } from '@/store/exo-cart-store';
import { createClient } from '@/lib/supabase/browser';
import { Wifi, WifiOff, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ConnectivityIndicator() {
    const [mounted, setMounted] = useState(false);
    const { isOnline, isSupabaseConnected, setConnectivity, pendingOrdersCount } = useExoCartStore();
    const supabase = createClient();

    useEffect(() => {
        setMounted(true);

        const handleOnline = () => setConnectivity(true, isSupabaseConnected);
        const handleOffline = () => setConnectivity(false, isSupabaseConnected);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            setConnectivity(navigator.onLine, true);
        });

        const interval = setInterval(async () => {
            const { error } = await supabase.from('restaurants').select('id').limit(1).single();
            setConnectivity(navigator.onLine, !error);
        }, 30000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            subscription.unsubscribe();
            clearInterval(interval);
        };
    }, [supabase, setConnectivity, isSupabaseConnected]);

    const isConnected = isOnline && isSupabaseConnected;

    // To prevent hydration mismatch, we don't render the connectivity status until mounted
    // but we render the container to maintain layout consistency.
    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-full border border-slate-700">
            {mounted && pendingOrdersCount > 0 && (
                <div className="flex items-center gap-1.5 mr-2 animate-pulse">
                    <RefreshCcw className="w-3.5 h-3.5 text-emerald-400 animate-spin-slow" />
                    <span className="text-[10px] font-bold text-emerald-400 uppercase">{pendingOrdersCount}</span>
                </div>
            )}

            <div className={cn(
                "w-2.5 h-2.5 rounded-full shadow-[0_0_8px] transition-colors duration-500",
                !mounted
                    ? "bg-slate-600 shadow-slate-600/50"
                    : isConnected
                        ? "bg-emerald-500 shadow-emerald-500/50"
                        : "bg-orange-500 shadow-orange-500/50 animate-pulse"
            )} />

            <span className={cn(
                "text-[10px] font-black uppercase tracking-widest transition-colors duration-500",
                !mounted
                    ? "text-slate-500"
                    : isConnected ? "text-emerald-500" : "text-orange-500"
            )}>
                {!mounted ? '...' : (isConnected ? 'Online' : 'Offline')}
            </span>

            {mounted && (
                isConnected ? (
                    <Wifi className="w-3 h-3 text-emerald-500/50" />
                ) : (
                    <WifiOff className="w-3 h-3 text-orange-500/50" />
                )
            )}
        </div>
    );
}
