'use client';

import OrderTicketContainer, { MOCK_ORDER } from '@/components/kiosk/OrderTicket';
import { useTranslations } from 'next-intl';

export default function PrintTestPage() {
    return (
        <div className="min-h-screen bg-gray-100 p-10 flex flex-col items-center gap-10">
            <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
                <h1 className="text-3xl font-black text-gray-900 mb-4">Prueba de Impresión</h1>
                <p className="text-gray-600 mb-8 font-medium">
                    Haz clic en el botón de abajo para generar la vista previa del ticket térmico (80mm) y lanzarlo a la impresora.
                </p>

                {/* El componente contiene el botón y el ticket oculto */}
                <OrderTicketContainer order={MOCK_ORDER} />
            </div>

            <div className="flex flex-col items-center">
                <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mb-4">Vista Previa Visual (No para impresión)</p>
                <div className="border border-gray-200 shadow-2xl rounded-lg overflow-hidden bg-white">
                    {/* Solo para que el dev vea el diseño sin imprimir */}
                    <div className="pointer-events-none scale-90 origin-top">
                        <div className="bg-white text-black p-4 font-mono w-[80mm] mx-auto shadow-inner">
                            <div className="text-center space-y-1 mb-4">
                                <h1 className="text-xl font-bold uppercase tracking-tighter italic underline">VISTA PREVIA</h1>
                                <p className="text-[10px]">DISEÑO DE TICKET TÉRMICO</p>
                            </div>
                            <div className="border-t border-dashed border-black my-2" />
                            <div className="flex justify-center my-3">
                                <div className="bg-black text-white px-4 py-1 font-bold text-sm tracking-widest">
                                    COMER AQUÍ
                                </div>
                            </div>
                            <div className="text-center py-4 border-y-2 border-black my-2">
                                <span className="text-sm font-bold block uppercase">Orden</span>
                                <span className="text-6xl font-black">#045</span>
                            </div>
                            <div className="space-y-1 my-4">
                                <div className="flex justify-between font-bold">
                                    <span>1 x BURGER ESPECIAL</span>
                                    <span>$12.50</span>
                                </div>
                                <div className="pl-4 text-[10px] italic">
                                    <div>NO CEBOLLA</div>
                                    <div>+ EXTRA QUESO ($1.00)</div>
                                </div>
                            </div>
                            <div className="border-t-2 border-black pt-2 flex justify-between text-lg font-black uppercase">
                                <span>Total</span>
                                <span>$13.50</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
