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
            className="flex items-center gap-2 px-6 py-3 bg-white border border-secondary-200 rounded-2xl font-bold text-secondary-700 hover:bg-secondary-50 hover:shadow-md transition-all active:scale-95 disabled:opacity-50 group"
        >
            <RefreshCcw className={`w-5 h-5 text-primary-500 ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            <span>Recargar Pruebas</span>
        </button>
    );
}
