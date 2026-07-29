'use client';

import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, CheckCircle2 } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface TicketModifier {
    name: string;
    price_extra?: number;
    type: 'extra' | 'removal';
}

interface TicketItem {
    name: string;
    quantity: number;
    price: number;
    modifiers?: TicketModifier[];
}

interface OrderTicketProps {
    order: {
        order_number: string | number;
        created_at: string;
        total_amount: number;
        type: 'DINE_IN' | 'TAKE_AWAY';
        items: TicketItem[];
        restaurant_name?: string;
    };
}

export const OrderTicket = React.forwardRef<HTMLDivElement, OrderTicketProps>(
    ({ order }, ref) => {
        const t = useTranslations('kiosk');
        const date = new Date(order.created_at).toLocaleString();

        return (
            <div
                ref={ref}
                className="bg-white text-black p-4 font-mono w-[80mm] mx-auto print:m-0 print:w-full"
                style={{ fontSize: '12px', lineHeight: '1.2' }}
            >
                {/* Header */}
                <div className="text-center space-y-1 mb-4">
                    <h1 className="text-xl font-bold uppercase tracking-tighter">
                        {order.restaurant_name || 'ORDERPOINT POS'}
                    </h1>
                    <p className="text-[10px]">{date}</p>
                </div>

                {/* Vertical Divider */}
                <div className="border-t border-dashed border-black my-2" />

                {/* Order Type Badge */}
                <div className="flex justify-center my-3">
                    <div className="bg-black text-white px-4 py-1 font-bold text-sm tracking-widest">
                        {order.type === 'DINE_IN' ? t('dineIn').toUpperCase() : t('takeout').toUpperCase()}
                    </div>
                </div>

                {/* Big Order Number */}
                <div className="text-center py-4 border-y-2 border-black my-2">
                    <span className="text-sm font-bold block uppercase">{t('order')}</span>
                    <span className="text-6xl font-black">
                        #{String(order.order_number).padStart(3, '0')}
                    </span>
                </div>

                {/* Items List */}
                <div className="space-y-3 my-4">
                    <div className="flex justify-between font-bold text-[10px] border-b border-black pb-1 uppercase">
                        <span>{t('qtyProduct')}</span>
                        <span>{t('subtotal')}</span>
                    </div>
                    {order.items.map((item, idx) => (
                        <div key={idx} className="space-y-1">
                            <div className="flex justify-between items-start">
                                <span className="font-bold flex-1">
                                    {item.quantity} x {item.name.toUpperCase()}
                                </span>
                                <span className="font-bold">
                                    {formatPrice(item.price * item.quantity)}
                                </span>
                            </div>

                            {/* Modifiers */}
                            {item.modifiers && item.modifiers.length > 0 && (
                                <div className="pl-4 space-y-0.5 text-[10px]">
                                    {item.modifiers.map((mod, mIdx) => (
                                        <div key={mIdx} className="flex justify-between italic">
                                            <span>
                                                {mod.type === 'removal' ? (
                                                    <span className="uppercase text-black">
                                                        {t('no')} {mod.name}
                                                    </span>
                                                ) : (
                                                    <span>+ {mod.name}</span>
                                                )}
                                            </span>
                                            {mod.price_extra && mod.price_extra > 0 ? (
                                                <span>{formatPrice(mod.price_extra)}</span>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Totals */}
                <div className="border-t-2 border-black pt-2 space-y-1">
                    <div className="flex justify-between text-lg font-black uppercase">
                        <span>{t('totalPaid')}</span>
                        <span>{formatPrice(order.total_amount)}</span>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center mt-8 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest">
                        {t('thanksForPurchase')}
                    </p>
                    <div className="flex justify-center opacity-20">
                        {/* Placeholder for QR code if needed later */}
                        <div className="w-16 h-16 bg-black" />
                    </div>
                    <p className="text-[8px] italic">Powered by OrderPoint</p>
                </div>

                {/* Cut indicator for screen preview */}
                <div className="mt-4 border-t border-dashed border-gray-300 print:hidden" />
            </div>
        );
    }
);

OrderTicket.displayName = 'OrderTicket';

// Example Wrapper for Component with Print Logic
export default function OrderTicketContainer({ order }: { order: any }) {
    const t = useTranslations('kiosk');
    const componentRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Order_${order.order_number}`,
        onAfterPrint: () => console.log('Impresión completada'),
    });

    return (
        <div className="flex flex-col items-center">
            {/* Oculto en pantalla normal, visible para el botón o impresión */}
            <div className="hidden">
                <OrderTicket ref={componentRef} order={order} />
            </div>

            <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-secondary-900 text-white rounded-xl font-bold hover:bg-black transition-all active:scale-95 shadow-lg"
            >
                <Printer className="w-4 h-4" />
                <span>{t('printTicket')}</span>
            </button>
        </div>
    );
}

// Ejemplo de datos para pruebas
export const MOCK_ORDER = {
    order_number: 45,
    created_at: new Date().toISOString(),
    total_amount: 14.50,
    type: 'DINE_IN',
    restaurant_name: 'EL PALACIO DE LA BURGER',
    items: [
        {
            name: 'Hamburguesa Clásica',
            quantity: 1,
            price: 8.50,
            modifiers: [
                { name: 'Término Medio', type: 'extra' },
                { name: 'Cebolla', type: 'removal' },
                { name: 'Bacon', price_extra: 1.50, type: 'extra' }
            ]
        },
        {
            name: 'Papas Fritas XL',
            quantity: 1,
            price: 3.50,
            modifiers: [
                { name: 'Queso Extra', price_extra: 1.00, type: 'extra' }
            ]
        }
    ]
};
