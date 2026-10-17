'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { X, Send, Loader2, CheckCircle2, AlertCircle, Copy, Check, MessageSquare } from 'lucide-react';
import { inviteRestaurantOwner } from '@/actions/invite-owner';

interface InviteOwnerModalProps {
    restaurantId: string;
    restaurantName: string;
    initialInviteLink?: string | null;
    initialEmail?: string | null;
    initialEmailSent?: boolean;
    onClose: () => void;
}

export default function InviteOwnerModal({
    restaurantId,
    restaurantName,
    initialInviteLink = null,
    initialEmail = null,
    initialEmailSent = false,
    onClose
}: InviteOwnerModalProps) {
    const params = useParams();
    const locale = params.locale as string;
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [status, setStatus] = useState<{
        type: 'success' | 'error' | null;
        message: string | null;
        inviteLink?: string | null;
        emailSent?: boolean;
    }>(
        initialInviteLink
            ? {
                  type: 'success',
                  message: initialEmailSent
                      ? `Correo enviado a ${initialEmail || 'el propietario'} y enlace directo listo para ${restaurantName}.`
                      : `Invitación creada para ${initialEmail || 'el propietario'} (${restaurantName}). Envíale el enlace directo por WhatsApp.`,
                  inviteLink: initialInviteLink,
                  emailSent: initialEmailSent
              }
            : { type: null, message: null, inviteLink: null, emailSent: false }
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setLoading(true);
        setStatus({ type: null, message: null, inviteLink: null, emailSent: false });

        try {
            const result = await inviteRestaurantOwner(email, restaurantId, locale);

            if (result.error) {
                setStatus({
                    type: 'error',
                    message: result.error,
                    inviteLink: null,
                    emailSent: false
                });
            } else {
                setStatus({
                    type: 'success',
                    message: result.emailSent
                        ? `Correo enviado a ${email} para el restaurante "${restaurantName}".`
                        : `Invitación generada para ${email} en "${restaurantName}". Comparte el enlace directo por WhatsApp.`,
                    inviteLink: result.inviteLink || null,
                    emailSent: Boolean(result.emailSent)
                });
                setEmail('');
            }
        } catch (error) {
            setStatus({
                type: 'error',
                message: 'Error al procesar la solicitud',
                inviteLink: null,
                emailSent: false
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCopyLink = () => {
        if (!status.inviteLink) return;
        navigator.clipboard.writeText(status.inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
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
                        <div className="flex flex-col items-center justify-center py-4 text-center">
                            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-3">
                                <CheckCircle2 className="w-7 h-7 text-green-600" />
                            </div>
                            <p className="text-green-700 font-bold text-lg mb-1">¡Invitación Registrada!</p>
                            <p className="text-slate-600 text-xs mb-4">{status.message}</p>

                            {status.inviteLink && (
                                <div className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-5 text-left">
                                    <div className="flex items-center gap-1.5 mb-2 text-emerald-700">
                                        <MessageSquare className="w-4 h-4 shrink-0" />
                                        <span className="text-xs font-black uppercase tracking-wider">Acceso Directo (WhatsApp / SMS)</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mb-3">
                                        Si el correo demora o no llega a su bandeja, envíale este enlace directo para que configure su contraseña:
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleCopyLink}
                                        className={`w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                                            copied
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-slate-900 hover:bg-slate-800 text-white shadow-md active:scale-95'
                                        }`}
                                    >
                                        {copied ? (
                                            <>
                                                <Check className="w-4 h-4 text-white" />
                                                <span>¡Enlace Copiado al Portapapeles!</span>
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4 text-emerald-400" />
                                                <span>Copiar Enlace de Activación</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            <button
                                onClick={onClose}
                                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-3.5 rounded-2xl transition-all text-xs uppercase tracking-wider"
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
