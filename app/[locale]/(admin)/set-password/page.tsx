'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from '@/i18n/routing';
import { Lock, User, Loader2, CheckCircle2, ScrollText, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';

export default function SetPasswordPage() {
    const params = useParams();
    const locale = params.locale as string;
    const t = useTranslations('admin');
    const router = useRouter();
    const supabase = createClient();

    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [hasSession, setHasSession] = useState(false);
    const [checkingSession, setCheckingSession] = useState(true);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [showTerms, setShowTerms] = useState(false);
    const [termsLanguage, setTermsLanguage] = useState<'es' | 'en'>(locale === 'en' ? 'en' : 'es');

    useEffect(() => {
        let isMounted = true;

        const handleAuth = async () => {
            const currentHash = window.location.hash;
            if (!currentHash) {
                console.log('No hash fragment found');
                return;
            }

            // Debug de llaves en el hash
            const params = new URLSearchParams(currentHash.substring(1));
            const keys = Array.from(params.keys());
            console.log('Hash keys found:', keys);

            if (params.has('error')) {
                const errorMsg = params.get('error_description') || params.get('error') || 'Unknown auth error';
                console.error('Auth error in hash:', errorMsg);
                setError(`Error de autenticación: ${errorMsg}`);
                setCheckingSession(false);
                return;
            }

            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');

            if (accessToken && refreshToken) {
                console.log('Attempting manual session set...');
                const { data, error: setSessionError } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken
                });

                if (setSessionError) {
                    console.error('Manual setSession error:', setSessionError);
                    setError(`Error al establecer sesión: ${setSessionError.message}`);
                } else if (data.session) {
                    console.log('Manual session set successful');
                    const user = data.session.user;
                    if (user && user.invited_at) {
                        const invitedTime = new Date(user.invited_at).getTime();
                        const currentTime = new Date().getTime();
                        const diffMinutes = (currentTime - invitedTime) / (1000 * 60);
                        if (diffMinutes > 1440) {
                            setError('Esta invitación ha expirado porque superó el límite de 24 horas. Solicita una nueva invitación al administrador.');
                            setCheckingSession(false);
                            return;
                        }
                    }
                    setHasSession(true);
                    setCheckingSession(false);
                }
            }
        };

        handleAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('Supabase Auth Event:', event, session ? 'Session active' : 'No session');
            if (session && isMounted) {
                const user = session.user;
                if (user && user.invited_at) {
                    const invitedTime = new Date(user.invited_at).getTime();
                    const currentTime = new Date().getTime();
                    const diffMinutes = (currentTime - invitedTime) / (1000 * 60);
                    if (diffMinutes > 1440) {
                        setError('Esta invitación ha expirado porque superó el límite de 24 horas. Solicita una nueva invitación al administrador.');
                        setHasSession(false);
                        setCheckingSession(false);
                        return;
                    }
                }
                setHasSession(true);
                setCheckingSession(false);
            }
        });

        const timer = setTimeout(() => {
            if (isMounted && !hasSession) {
                setCheckingSession(false);
            }
        }, 10000);

        return () => {
            isMounted = false;
            subscription.unsubscribe();
            clearTimeout(timer);
        };
    }, [supabase, hasSession]);

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (password !== confirmPassword) {
            setError(t('passwordMismatch'));
            setLoading(false);
            return;
        }

        try {
            // Verificar sesión antes de proceder
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error('No se encontró una sesión activa de invitación. Asegúrate de haber hecho clic en el enlace del correo y de no haber recargado la página manualmente.');
            }

            // Validar que la invitación no tenga más de 10 minutos
            if (session.user && session.user.invited_at) {
                const invitedTime = new Date(session.user.invited_at).getTime();
                const currentTime = new Date().getTime();
                const diffMinutes = (currentTime - invitedTime) / (1000 * 60);
                if (diffMinutes > 1440) {
                    throw new Error('Esta invitación ha expirado porque superó el límite de 24 horas. Por favor, solicita al administrador que te envíe una nueva invitación.');
                }
            }

            // 1. Actualizar la contraseña en Auth
            const { error: authError } = await supabase.auth.updateUser({
                password: password,
            });

            if (authError) throw authError;

            // 2. Actualizar el nombre completo en el perfil público
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { error: profileError } = await (supabase as any)
                    .from('profiles')
                    .update({
                        full_name: fullName,
                        terms_accepted: true,
                        terms_accepted_at: new Date().toISOString(),
                        terms_version: 'v1.0'
                    })
                    .eq('id', user.id);

                if (profileError) {
                    console.error('Error updating profile name:', profileError);
                    // No bloqueamos el flujo principal si solo falló el nombre
                }
            }

            setSuccess(true);

            // Redirigir después de un momento
            setTimeout(() => {
                router.push('/admin/dashboard');
            }, 2000);

        } catch (err: any) {
            console.error('SetPassword Error:', err);
            setError(err.message || t('error'));
        } finally {
            setLoading(false);
        }
    };

    if (checkingSession) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
                    <p className="text-slate-500 font-bold animate-pulse">Verificando invitación...</p>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-12 text-center animate-in zoom-in-95 duration-500">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6 text-green-600">
                        <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 mb-4">{t('passwordSuccess')}</h1>
                    <p className="text-slate-500 font-medium">Redirigiendo al panel...</p>
                </div>
            </div>
        );
    }

    if (!hasSession && !checkingSession) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 border border-red-100 text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-red-50 rounded-3xl mb-6 text-red-600 font-black text-4xl">!</div>
                    <h1 className="text-2xl font-black text-slate-900 mb-4">Invitación No Válida</h1>
                    <p className="text-slate-500 font-bold leading-relaxed mb-8">
                        No hemos detectado una sesión activa de invitación. Esto puede ocurrir si:
                    </p>
                    <ul className="text-left text-sm text-slate-600 space-y-3 mb-8 font-medium">
                        <li className="flex gap-3">
                            <span className="text-red-500">•</span>
                            El enlace ya fue utilizado o ha expirado.
                        </li>
                        <li className="flex gap-3">
                            <span className="text-red-500">•</span>
                            Hubo un error al cargar los códigos de seguridad del correo.
                        </li>
                        <li className="flex gap-3">
                            <span className="text-red-500">•</span>
                            Recargaste la página de forma manual.
                        </li>
                    </ul>

                    <div className="mt-8 pt-6 border-t border-slate-100">
                        <p className="text-[10px] text-slate-400 font-mono break-all uppercase tracking-tighter">
                            Debug Info: {hasSession ? 'Session OK' : 'No Session'} | Hash: {typeof window !== 'undefined' ? (window.location.hash ? 'Hash Present' : 'Hash Missing') : 'SSR'}
                        </p>
                    </div>

                    <p className="text-xs text-slate-400 italic mt-4">Por favor, vuelve a tu correo y haz clic en el botón original.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 border border-slate-100">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-50 rounded-3xl mb-6 rotate-3">
                        <Lock className="w-10 h-10 text-primary-600 -rotate-3" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">{t('setPassword')}</h1>
                    <p className="text-slate-500 mt-2 font-bold uppercase tracking-widest text-xs">Completa tu registro en OrderPoint</p>
                </div>

                {!checkingSession && !error && error !== t('passwordMismatch') && (
                    <div className="mb-8 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                        <p className="text-xs text-amber-800 font-bold leading-relaxed">
                            ⚠️ Si ves un error de "Session Missing", asegúrate de haber hecho clic exactamente en el enlace del correo. No modifiques la URL manualmente.
                        </p>
                    </div>
                )}

                <form onSubmit={handleSetPassword} className="space-y-6">
                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                            {t('fullName')}
                        </label>
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                                className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-primary-500 focus:bg-white outline-none transition-all font-bold"
                                placeholder="Ej: Juan Pérez"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                            {t('password')}
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-primary-500 focus:bg-white outline-none transition-all font-bold"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                            {t('confirmPassword')}
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-primary-500 focus:bg-white outline-none transition-all font-bold"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <div className="flex items-start gap-3 px-1">
                        <Checkbox
                            id="terms"
                            checked={termsAccepted}
                            onCheckedChange={(checked) => setTermsAccepted(!!checked)}
                            className="mt-1"
                        />
                        <label htmlFor="terms" className="text-sm text-slate-500 font-medium leading-tight">
                            {locale === 'en' ? (
                                <>
                                    I have read and accept the <button type="button" onClick={() => setShowTerms(true)} className="text-primary-600 font-bold hover:underline">Terms & Conditions</button> and Privacy Policy of OrderPoint.
                                </>
                            ) : (
                                <>
                                    He leído y acepto los <button type="button" onClick={() => setShowTerms(true)} className="text-primary-600 font-bold hover:underline">Términos y Condiciones</button> y la Política de Privacidad de OrderPoint.
                                </>
                            )}
                        </label>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-bold flex items-center gap-3">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !termsAccepted}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-5 rounded-[2rem] shadow-xl shadow-slate-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:bg-slate-300 disabled:shadow-none flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            t('savePassword')
                        )}
                    </button>
                </form>
            </div>

            {/* Terms Modal */}
            {showTerms && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                        <div className="relative p-6 pt-8 pb-4 border-b border-slate-100 shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowTerms(false)}
                                className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors"
                            >
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-12">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-primary-50 rounded-2xl">
                                        <ScrollText className="w-6 h-6 text-primary-600" />
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-900 leading-tight">
                                        {termsLanguage === 'es' ? 'Términos y Condiciones' : 'Terms & Conditions'}
                                    </h2>
                                </div>
                                
                                {/* Language Toggle Switch */}
                                <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
                                    <button
                                        type="button"
                                        onClick={() => setTermsLanguage('es')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${termsLanguage === 'es' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                                    >
                                        ES
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTermsLanguage('en')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${termsLanguage === 'en' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                                    >
                                        EN
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="p-8 overflow-y-auto grow text-slate-600 space-y-4">
                            {termsLanguage === 'es' ? (
                                <>
                                    <p className="font-medium text-slate-800">
                                        Bienvenido a OrderPoint. Al aceptar esta invitación y usar nuestros servicios, aceptas estos términos y condiciones.
                                    </p>
                                    <h3 className="font-bold text-slate-900 pt-2">1. Uso del Servicio</h3>
                                    <p className="text-sm leading-relaxed">
                                        El usuario se compromete a utilizar la plataforma de acuerdo con la ley, la moral y el orden público. Toda la información proporcionada debe ser veraz y mantenerse actualizada.
                                    </p>
                                    <h3 className="font-bold text-slate-900 pt-2">2. Pasarela de Pagos y Suscripciones (Stripe)</h3>
                                    <p className="text-sm leading-relaxed">
                                        Para procesar pagos, gestionar suscripciones y emitir facturas mensuales automáticas, OrderPoint utiliza la infraestructura de Stripe. Al aceptar estos términos, autorizas el procesamiento de cobros automáticos basados en la cantidad de licencias contratadas.
                                    </p>
                                    <h3 className="font-bold text-slate-900 pt-2">3. Procesamiento con Inteligencia Artificial (IA)</h3>
                                    <p className="text-sm leading-relaxed">
                                        OrderPoint utiliza servicios de inteligencia artificial (como Gemini API) para asistir y automatizar el soporte técnico y de atención al cliente. Tus interacciones con el bot de soporte pueden ser procesadas para mejorar la calidad del servicio.
                                    </p>
                                    <h3 className="font-bold text-slate-900 pt-2">4. Privacidad y Datos</h3>
                                    <p className="text-sm leading-relaxed">
                                        Nos tomamos muy en serio tu privacidad. La recopilación y el uso de tu información personal se rigen por nuestra Política de Privacidad. No compartimos tu información con terceros sin tu consentimiento.
                                    </p>
                                    <h3 className="font-bold text-slate-900 pt-2">5. Responsabilidad</h3>
                                    <p className="text-sm leading-relaxed">
                                        OrderPoint provee la infraestructura tecnológica, pero cada restaurante es responsable del manejo de sus operaciones, menú, pedidos y cumplimiento fiscal aplicable.
                                    </p>
                                    <div className="mt-6 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-500 uppercase tracking-widest text-center">
                                        Versión v1.1 - Última actualización: Julio 2026
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="font-medium text-slate-800">
                                        Welcome to OrderPoint. By accepting this invitation and using our services, you agree to these terms and conditions.
                                    </p>
                                    <h3 className="font-bold text-slate-900 pt-2">1. Service Usage</h3>
                                    <p className="text-sm leading-relaxed">
                                        The user agrees to use the platform in accordance with the law, moral principles, and public order. All information provided must be accurate and kept up to date.
                                    </p>
                                    <h3 className="font-bold text-slate-900 pt-2">2. Payment Gateway and Subscriptions (Stripe)</h3>
                                    <p className="text-sm leading-relaxed">
                                        To process payments, manage subscriptions, and issue automatic monthly invoices, OrderPoint uses Stripe's infrastructure. By accepting these terms, you authorize automatic billing based on your contracted licenses.
                                    </p>
                                    <h3 className="font-bold text-slate-900 pt-2">3. Artificial Intelligence (AI) Processing</h3>
                                    <p className="text-sm leading-relaxed">
                                        OrderPoint utilizes artificial intelligence services (such as Gemini API) to assist and automate customer service and technical support. Your interactions with the support bot may be processed to improve service quality.
                                    </p>
                                    <h3 className="font-bold text-slate-900 pt-2">4. Privacy and Data</h3>
                                    <p className="text-sm leading-relaxed">
                                        We take your privacy very seriously. The collection and use of your personal information are governed by our Privacy Policy. We do not share your information with third parties without your consent.
                                    </p>
                                    <h3 className="font-bold text-slate-900 pt-2">5. Liability</h3>
                                    <p className="text-sm leading-relaxed">
                                        OrderPoint provides the technological infrastructure, but each restaurant is solely responsible for managing its operations, menu, orders, and applicable tax compliance.
                                    </p>
                                    <div className="mt-6 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-500 uppercase tracking-widest text-center">
                                        Version v1.1 - Last updated: July 2026
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="p-6 border-t border-slate-100 shrink-0 bg-slate-50">
                            <button
                                type="button"
                                onClick={() => {
                                    setTermsAccepted(true);
                                    setShowTerms(false);
                                }}
                                className="w-full bg-primary-500 hover:bg-primary-600 text-white font-black py-4 rounded-[1.5rem] transition-all shadow-lg hover:-translate-y-0.5 tracking-widest uppercase text-sm"
                            >
                                {termsLanguage === 'es' ? 'HE LEÍDO Y ACEPTO LOS TÉRMINOS' : 'I HAVE READ AND ACCEPT THE TERMS'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
