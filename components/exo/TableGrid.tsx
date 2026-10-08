'use client';

import { useRouter } from '@/i18n/routing';
import { useExoCartStore } from '@/store/exo-cart-store';
import { cn } from '@/lib/utils';
import { Utensils } from 'lucide-react';

interface Table {
    id: string;
    number: string;
    status: 'free' | 'occupied';
    waitress_name?: string | null;
}

interface TableGridProps {
    tables: Table[];
}

export default function TableGrid({ tables }: TableGridProps) {
    const router = useRouter();
    const setTableId = useExoCartStore((state) => state.setTableId);

    const handleTableClick = (table: Table) => {
        setTableId(table.id);
        router.push(`/exo/menu/${table.id}`);
    };

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {tables.map((table) => (
                <button
                    key={table.id}
                    onClick={() => handleTableClick(table)}
                    className={cn(
                        "aspect-square p-4 sm:p-5 rounded-[32px] border-2 flex flex-col items-center justify-center gap-2.5 sm:gap-3 transition-all duration-300 active:scale-95 relative overflow-hidden group",
                        table.status === 'occupied'
                            ? "border-red-500/80 bg-gradient-to-br from-red-950/50 via-slate-900 to-rose-950/60 shadow-[0_0_25px_rgba(239,68,68,0.35)] hover:shadow-[0_0_35px_rgba(239,68,68,0.55)] hover:border-red-400"
                            : "border-emerald-500/80 bg-gradient-to-br from-emerald-950/50 via-slate-900 to-teal-950/60 shadow-[0_0_25px_rgba(16,185,129,0.35)] hover:shadow-[0_0_35px_rgba(16,185,129,0.55)] hover:border-emerald-400"
                    )}
                >
                    {/* Ambient glow highlight */}
                    <div className={cn(
                        "absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl pointer-events-none transition-opacity",
                        table.status === 'occupied' ? "bg-red-500/25" : "bg-emerald-500/25"
                    )} />

                    <div className={cn(
                        "w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 flex-shrink-0",
                        table.status === 'occupied'
                            ? "bg-gradient-to-tr from-red-600 to-rose-400 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                            : "bg-gradient-to-tr from-emerald-600 to-teal-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                    )}>
                        <Utensils className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>

                    <div className="text-center relative z-10 w-full px-1">
                        <span className="block text-2xl sm:text-3xl font-black italic tracking-tighter leading-none text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                            #{table.number}
                        </span>
                        <span className={cn(
                            "text-[9px] sm:text-[10px] uppercase font-black tracking-widest mt-1 block",
                            table.status === 'occupied' ? "text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]" : "text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                        )}>
                            {table.status === 'occupied' ? 'Ocupada' : 'Disponible'}
                        </span>
                        {table.status === 'occupied' && (
                            <span className="text-[9px] sm:text-[10px] font-black text-rose-200/90 truncate block mt-1 tracking-tight uppercase bg-red-950/60 px-2 py-0.5 rounded-full border border-red-500/30 max-w-[95%] mx-auto shadow-sm">
                                {table.waitress_name || 'En atención'}
                            </span>
                        )}
                    </div>
                </button>
            ))}
        </div>
    );
}
