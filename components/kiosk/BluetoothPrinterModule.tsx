'use client';

import React, { useState } from 'react';
import { Printer, Wifi, WifiOff, RefreshCw, CheckCircle2, AlertTriangle, CreditCard } from 'lucide-react';
import { useBluetoothPrinter } from '@/hooks/useBluetoothPrinter';
import { buildEscPosReceipt, KioskReceiptData } from '@/lib/escpos';

interface BluetoothPrinterModuleProps {
    orderData?: KioskReceiptData;
    onPaymentSuccess?: () => void;
}

export const MOCK_KIOSK_ORDER: KioskReceiptData = {
    restaurantName: 'ORDERPOINT BURGER & KIOSK',
    orderNumber: 104,
    orderType: 'DINE_IN',
    createdAt: new Date().toISOString(),
    totalAmount: 24.50,
    items: [
        {
            name: 'Double Bacon Cheese Burger',
            quantity: 2,
            price: 9.50,
            modifiers: [
                { name: 'Extra Salsa BBQ', priceExtra: 0.75, type: 'extra' },
                { name: 'Cebolla', type: 'removal' }
            ]
        },
        {
            name: 'Papas Fritas Medianas',
            quantity: 1,
            price: 3.50,
            modifiers: [
                { name: 'Queso Cheddar Fundido', priceExtra: 1.25, type: 'extra' }
            ]
        }
    ],
    footerText: '¡GRACIAS POR SU PREFERENCIA!'
};

export function BluetoothPrinterModule({
    orderData = MOCK_KIOSK_ORDER,
    onPaymentSuccess,
}: BluetoothPrinterModuleProps) {
    const {
        status,
        deviceName,
        errorMessage,
        isSupported,
        autoConnect,
        connectPrinter,
        disconnectPrinter,
        printBuffer,
    } = useBluetoothPrinter();

    const [isProcessing, setIsProcessing] = useState(false);
    const [printNotification, setPrintNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    /**
     * Trigger principal: Se ejecuta como Callback dentro del evento onClick del botón 'Pagar/Confirmar'
     * Cumple estrictamente la regla de User Gesture del navegador.
     */
    const handleConfirmAndPay = async () => {
        setIsProcessing(true);
        setPrintNotification(null);

        try {
            // 1. Simulación de procesamiento de pago en Kiosco
            await new Promise((res) => setTimeout(res, 800));

            // 2. Construir buffer de impresión ESC/POS para 80mm
            const receiptBytes = buildEscPosReceipt(orderData, 48);

            // 3. Imprimir directamente a GATT (Zero-Dialog)
            const result = await printBuffer(receiptBytes);

            if (result.success) {
                setPrintNotification({
                    type: 'success',
                    text: '¡Pago completado y Ticket impreso correctamente!',
                });
                if (onPaymentSuccess) onPaymentSuccess();
            } else {
                setPrintNotification({
                    type: 'error',
                    text: result.error || 'No se pudo imprimir el ticket.',
                });
            }
        } catch (err: any) {
            setPrintNotification({
                type: 'error',
                text: 'Error inesperado durante la confirmación.',
            });
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isSupported) {
        return (
            <div className="bg-slate-900 text-white p-6 rounded-[32px] shadow-xl border border-slate-800">
                <div className="flex items-center gap-3 text-orange-500 font-black text-lg">
                    <AlertTriangle className="w-6 h-6" />
                    <span>Navegador No Soportado</span>
                </div>
                <p className="text-slate-400 text-sm mt-2">
                    Web Bluetooth API no está habilitado en este dispositivo. Utiliza Fully Kiosk Browser o Chrome para Android.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-slate-900 text-white p-6 rounded-[32px] shadow-2xl border border-slate-800 space-y-6 max-w-md mx-auto">
            {/* Header del Estado de Impresora */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl ${status === 'connected' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-500'}`}>
                        <Printer className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-black text-base text-slate-100 tracking-wide">Impresora Kiosco (80mm)</h3>
                        <p className="text-xs font-semibold text-slate-400">
                            {status === 'connected' ? (
                                <span className="text-emerald-400 flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    Conectado: {deviceName}
                                </span>
                            ) : status === 'connecting' || status === 'searching' ? (
                                <span className="text-orange-400 flex items-center gap-1">
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    Buscando servidor GATT...
                                </span>
                            ) : (
                                <span className="text-slate-400">Desconectado (Modo Silencioso)</span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Acciones de Conexión */}
                <div>
                    {status === 'connected' ? (
                        <button
                            type="button"
                            onClick={disconnectPrinter}
                            className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 transition"
                        >
                            Desconectar
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={connectPrinter}
                            className="flex items-center gap-1.5 text-xs font-black text-white bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-full shadow-lg shadow-orange-500/20 active:scale-95 transition"
                        >
                            <Wifi className="w-3.5 h-3.5" />
                            Emparejar
                        </button>
                    )}
                </div>
            </div>

            {/* Mensajes de Advertencia / Error */}
            {errorMessage && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* Notificaciones de Impresión */}
            {printNotification && (
                <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 ${printNotification.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    {printNotification.type === 'success' ? (
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                    ) : (
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                    )}
                    <span>{printNotification.text}</span>
                </div>
            )}

            {/* Detalle del Pedido Resumido */}
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-400 uppercase">
                    <span>Orden #{orderData.orderNumber}</span>
                    <span>{orderData.orderType === 'DINE_IN' ? 'Para Comer Aquí' : 'Para Llevar'}</span>
                </div>
                <div className="text-xl font-black text-white flex justify-between items-center">
                    <span>Total a Pagar</span>
                    <span className="text-orange-500">${orderData.totalAmount.toFixed(2)}</span>
                </div>
            </div>

            {/* Botón Principal: Trigger onClick 'Pagar / Confirmar' */}
            <button
                type="button"
                onClick={handleConfirmAndPay}
                disabled={isProcessing}
                className="w-full py-4 px-6 rounded-[32px] bg-orange-500 hover:bg-orange-600 disabled:bg-slate-800 text-white font-black text-lg tracking-wider shadow-xl shadow-orange-500/25 active:scale-98 transition flex items-center justify-center gap-3"
            >
                {isProcessing ? (
                    <>
                        <RefreshCw className="w-6 h-6 animate-spin text-white" />
                        <span>PROCESANDO E IMPRIMIENDO...</span>
                    </>
                ) : (
                    <>
                        <CreditCard className="w-6 h-6" />
                        <span>PAGAR Y CONFIRMAR (${orderData.totalAmount.toFixed(2)})</span>
                    </>
                )}
            </button>
        </div>
    );
}
