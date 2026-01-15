'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from '@/i18n/routing';
import { Lock, User, Loader2, CheckCircle2 } from 'lucide-react';

export default function SetPasswordPage() {
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
                    setHasSession(true);
                    setCheckingSession(false);
                }
            }
        };

        handleAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('Supabase Auth Event:', event, session ? 'Session active' : 'No session');
            if (session && isMounted) {
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
                    .update({ full_name: fullName })
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

                    {error && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-bold flex items-center gap-3">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-5 rounded-[2rem] shadow-xl shadow-slate-200 transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            t('savePassword')
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
