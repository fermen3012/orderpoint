'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { use } from 'react';

export default function DebugOrderPage({ params }: { params: Promise<{ locale: string, restaurant_id: string }> }) {
    const resolvedParams = use(params);
    const { restaurant_id } = resolvedParams;

    const [lastOrder, setLastOrder] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createOrder = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Get next number
            const { data: nextNumber, error: rpcError } = await (supabase as any).rpc('get_next_order_number', {
                p_restaurant_id: restaurant_id
            });

            if (rpcError) throw rpcError;

            // 2. Create order
            const { data, error: insertError } = await (supabase as any)
                .from('orders')
                .insert({
                    restaurant_id,
                    total_amount: Math.random() * 100,
                    status: 'pending',
                    order_number: nextNumber
                })
                .select()
                .single();

            if (insertError) throw insertError;
            setLastOrder(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-20 flex flex-col items-center gap-8 bg-slate-900 min-h-screen text-white">
            <h1 className="text-4xl font-black italic">DEBUG: Test Numeración</h1>
            <p className="text-slate-400">Restaurante ID: {restaurant_id}</p>

            <Button
                onClick={createOrder}
                disabled={loading}
                className="h-20 px-12 rounded-[2rem] bg-primary-600 hover:bg-primary-500 text-2xl font-black shadow-2xl shadow-primary-500/20"
            >
                {loading ? 'Procesando...' : '🔥 Crear Orden de Prueba'}
            </Button>

            {error && (
                <div className="p-6 bg-red-500/20 border border-red-500/50 rounded-2xl text-red-500 font-bold">
                    Error: {error} (Asegúrate de ejecutar el SQL primero)
                </div>
            )}

            {lastOrder && (
                <div className="p-10 bg-white/5 border border-white/10 rounded-[3rem] text-center animate-in zoom-in duration-500">
                    <p className="text-slate-400 uppercase font-black tracking-widest text-sm mb-2">Orden Creada Correctamente</p>
                    <p className="text-8xl font-black text-primary-400">#{lastOrder.order_number}</p>
                    <p className="text-slate-500 mt-4 font-mono text-xs">ID: {lastOrder.id}</p>
                </div>
            )}

            <div className="mt-10 text-slate-500 text-sm max-w-md text-center">
                Haz clic varias veces para ver cómo el número se incrementa secuencialmente para este restaurante específico.
            </div>
        </div>
    );
}
