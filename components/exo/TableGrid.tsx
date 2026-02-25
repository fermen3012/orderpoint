'use client';

import { useRouter } from '@/i18n/routing';
import { useExoCartStore } from '@/store/exo-cart-store';
import { cn } from '@/lib/utils';
import { Utensils } from 'lucide-react';

interface Table {
    id: string;
    number: string;
    status: 'free' | 'occupied';
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
                        "aspect-square p-6 rounded-[32px] border-4 flex flex-col items-center justify-center gap-4 transition-all duration-300 active:scale-90",
                        table.status === 'occupied'
                            ? "border-orange-500 bg-orange-500/10 shadow-[0_0_20px_rgba(249,115,22,0.2)]"
                            : "border-slate-700 bg-slate-800/50 hover:border-slate-500"
                    )}
                >
                    <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center",
                        table.status === 'occupied' ? "bg-orange-500" : "bg-slate-700"
                    )}>
                        <Utensils className="w-6 h-6 text-white" />
                    </div>

                    <div className="text-center">
                        <span className="block text-3xl font-black italic tracking-tighter leading-none">
                            #{table.number}
                        </span>
                        <span className={cn(
                            "text-[10px] uppercase font-black tracking-widest mt-1 block",
                            table.status === 'occupied' ? "text-orange-500" : "text-slate-500"
                        )}>
                            {table.status === 'occupied' ? 'Ocupada' : 'Libre'}
                        </span>
                    </div>
                </button>
            ))}
        </div>
    );
}
