'use client';

import { useRouter } from 'next/navigation';
import { RefreshCcw } from 'lucide-react';
import { useState } from 'react';

export function RefreshButton() {
    const router = useRouter();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = () => {
        setIsRefreshing(true);
        router.refresh();
        // Reset state after a bit to show animation
        setTimeout(() => setIsRefreshing(false), 1000);
    };

    return (
        <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="group relative flex items-center justify-center gap-3 px-8 py-4 bg-slate-900 border border-slate-800 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 hover:border-emerald-500 transition-all active:scale-95 disabled:opacity-50 text-[10px]"
        >
            <RefreshCcw className={`w-5 h-5 text-emerald-500 ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            <span>Recargar Pruebas</span>
        </button>
    );
}
