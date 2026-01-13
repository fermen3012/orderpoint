'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { X, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { inviteRestaurantOwner } from '@/actions/invite-owner';

interface InviteOwnerModalProps {
    restaurantId: string;
    restaurantName: string;
    onClose: () => void;
}

export default function InviteOwnerModal({
    restaurantId,
    restaurantName,
    onClose
}: InviteOwnerModalProps) {
    const params = useParams();
    const locale = params.locale as string;
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{
        type: 'success' | 'error' | null;
        message: string | null;
    }>({ type: null, message: null });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setLoading(true);
        setStatus({ type: null, message: null });

        try {
            const result = await inviteRestaurantOwner(email, restaurantId, locale);

            if (result.error) {
                setStatus({
                    type: 'error',
                    message: result.error
                });
            } else {
                setStatus({
                    type: 'success',
                    message: `Invitación enviada exitosamente a ${email}`
                });
                setEmail('');
                // Opcional: Cerrar después de un tiempo
                setTimeout(() => {
                    // onClose();
                }, 3000);
            }
        } catch (error) {
            setStatus({
                type: 'error',
                message: 'Error al procesar la solicitud'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="relative p-8 pb-4">
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                    <h2 className="text-2xl font-black text-slate-900 leading-tight">
                        Invitar Dueño
                    </h2>
                    <p className="text-slate-500 mt-1 font-medium">
                        Restaurante: <span className="text-primary-600 font-bold">{restaurantName}</span>
                    </p>
                </div>

                {/* Content */}
                <div className="p-8 pt-2">
                    {status.type === 'success' ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-8 h-8 text-green-600" />
                            </div>
                            <p className="text-green-700 font-bold text-lg mb-2">¡Enviado!</p>
                            <p className="text-slate-600 mb-6">{status.message}</p>
                            <button
                                onClick={onClose}
                                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-4 rounded-2xl transition-all"
                            >
                                Cerrar
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                                    Correo Electrónico
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="ejemplo@correo.com"
                                    className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-primary-500 focus:bg-white outline-none transition-all font-medium"
                                />
                            </div>

                            {status.type === 'error' && (
                                <div className="flex items-start gap-3 p-4 bg-red-50 rounded-2xl border border-red-100">
                                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                                    <p className="text-sm text-red-700 font-medium">{status.message}</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !email}
                                className={`
                                    w-full py-4 rounded-2xl font-black flex items-center justify-center gap-3 transition-all duration-300
                                    ${loading || !email
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : 'bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-200 hover:-translate-y-0.5 active:scale-95'
                                    }
                                `}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>ENVIANDO...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>ENVIAR INVITACIÓN</span>
                                        <Send className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">
                        El usuario recibirá un correo para configurar su contraseña
                    </p>
                </div>
            </div>
        </div>
    );
}
