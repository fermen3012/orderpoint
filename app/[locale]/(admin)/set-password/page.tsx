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

            // 2. Actualizar o crear el perfil público
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { error: profileError } = await (supabase as any)
                    .from('profiles')
                    .upsert({
                        id: user.id,
                        restaurant_id: user.user_metadata?.restaurant_id,
                        role: user.user_metadata?.role || 'owner',
                        full_name: fullName,
                        terms_accepted: true,
                        terms_accepted_at: new Date().toISOString(),
                        terms_version: 'v2.0-FL'
                    });

                if (profileError) {
                    console.error('Error upserting profile:', profileError);
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
                        <div className="p-8 overflow-y-auto grow text-slate-600 space-y-5 text-sm leading-relaxed">
                            {termsLanguage === 'es' ? (
                                <>
                                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                                        <p className="text-xs font-black text-emerald-800 uppercase tracking-wider mb-1">
                                            Aviso Legal y Jurisdicción (Estado de Florida, EE. UU.)
                                        </p>
                                        <p className="text-xs text-slate-700">
                                            Este contrato mercantil de Software como Servicio (SaaS) B2B se rige expresamente por las leyes del Estado de Florida, EE. UU. Al activar su cuenta de propietario (Owner), usted formaliza un acuerdo legal vinculante entre su establecimiento y <strong>Exo Advance LLC</strong> (compañía titular y proveedora del software y plataforma <strong>OrderPoint</strong>).
                                        </p>
                                    </div>

                                    <h3 className="font-black text-slate-900 pt-2 text-base">1. Aceptación y Firma Electrónica</h3>
                                    <p>
                                        Al marcar la casilla "He leído y acepto los Términos y Condiciones" y enviar este formulario, usted reconoce y acepta que su acción constituye una firma electrónica con plena validez legal, exigibilidad y efecto vinculante de conformidad con la <strong>Ley de Transacciones Electrónicas Uniformes de Florida (Florida Uniform Electronic Transaction Act - UETA, Fla. Stat. § 668.50)</strong> y la Ley Federal E-SIGN (15 U.S.C. § 7001).
                                    </p>

                                    <h3 className="font-black text-slate-900 pt-2 text-base">2. Licencia de Software SaaS B2B</h3>
                                    <p>
                                        OrderPoint otorga al Restaurante una licencia de uso limitada, revocable, no exclusiva e intransferible para acceder a la plataforma en la nube durante el período de suscripción contratado. Los servicios incluyen: Kiosko táctil de autoservicio, pantalla de cocina (Kitchen Display System - KDS en tiempo real), toma de órdenes por meseros (Exo Server), gestión de cartas y menús QR, y emisión de comandas e impresiones térmicas ESC/POS.
                                    </p>

                                    <h3 className="font-black text-slate-900 pt-2 text-base">3. Operación Gastronómica, Inocuidad y Alérgenos (Florida DBPR y DOH)</h3>
                                    <p>
                                        El Restaurante y su propietario son estricta y exclusivamente responsables de:
                                    </p>
                                    <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600">
                                        <li>La preparación, cocción, conservación de temperatura y salubridad de todos los alimentos y bebidas, cumpliendo con las normas del <strong>Departamento de Regulación Comercial y Profesional de Florida (DBPR)</strong> y del <strong>Departamento de Salud de Florida (Florida Department of Health)</strong>.</li>
                                        <li>La veracidad de los ingredientes, recetas, precios y advertencias obligatorias de alérgenos (mariscos, frutos secos, lácteos, gluten, etc.), así como las advertencias de consumo de alimentos crudos o poco cocidos.</li>
                                        <li>OrderPoint es un proveedor de tecnología de software y <strong>no asume ninguna responsabilidad civil o penal</strong> por intoxicaciones, reacciones alérgicas, disputas sobre preparación o cualquier daño a la salud de los comensales.</li>
                                    </ul>

                                    <h3 className="font-black text-slate-900 pt-2 text-base">4. Pagos, Facturación Recurrente (Stripe) e Impuestos de Florida</h3>
                                    <p>
                                        El cobro de suscripciones mensuales y licencias de OrderPoint se procesa a través de la infraestructura certificada de Stripe. Respecto a las ventas de comida a los comensales:
                                    </p>
                                    <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600">
                                        <li>El Restaurante actúa como el Comerciante Registrado (Merchant of Record).</li>
                                        <li>El Restaurante es el único responsable de configurar, recaudar y remitir el Impuesto sobre las Ventas de Florida (<strong>Florida Sales and Use Tax, Fla. Stat. Cap. 212</strong>) ante el Departamento de Rentas de Florida (Florida Department of Revenue).</li>
                                    </ul>

                                    <h3 className="font-black text-slate-900 pt-2 text-base">5. Protección de Datos y Privacidad (Florida FIPA)</h3>
                                    <p>
                                        OrderPoint implementa medidas técnicas de seguridad en cumplimiento con la <strong>Ley de Protección de Información de Florida (Florida Information Protection Act - FIPA, Fla. Stat. § 501.171)</strong> y las directivas PCI-DSS. No almacenamos datos sensibles de tarjetas de crédito o débito en nuestros servidores. El Restaurante es dueño legítimo de su menú y base de clientes y se compromete a no utilizar la plataforma para recopilar datos ilícitos.
                                    </p>

                                    <h3 className="font-black text-slate-900 pt-2 text-base">6. Funcionalidades con Inteligencia Artificial (Google Gemini)</h3>
                                    <p>
                                        OrderPoint integra modelos de Inteligencia Artificial para asistencia técnica y traducción automatizada de cartas y menús. Dichas funciones se entregan "tal cual". El Restaurante tiene la obligación de verificar la exactitud de cualquier descripción, traducción o precio generado por IA antes de ponerlo a disposición del público.
                                    </p>

                                    <h3 className="font-black text-slate-900 pt-2 text-base">7. Equipos Físicos, Hardware y Periféricos — Exclusión de Responsabilidad por Daños (Fla. Stat. §§ 672.316 y 672.509)</h3>
                                    <p>
                                        <strong>Exo Advance LLC (OrderPoint)</strong> es única y exclusivamente una empresa proveedora de <strong>Software como Servicio (SaaS)</strong>. En consecuencia, las obligaciones de soporte, mantenimiento y garantía de la empresa se limitan estricta y exclusivamente al funcionamiento del <strong>Software en la nube</strong>, rigiéndose los equipos físicos por las siguientes disposiciones mercantiles del Estado de Florida:
                                    </p>
                                    <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600">
                                        <li><strong>Transferencia del Riesgo de Pérdida y Custodia (Fla. Stat. § 672.509):</strong> Desde el momento exacto en que cualquier equipo físico o hardware (tabletas para Kiosko, pantallas o monitores para KDS de cocina, dispositivos móviles para meseros, impresoras térmicas Bluetooth/ESC-POS, bases, soportes, cableado, adaptadores o routers) es entregado o instalado en el local del Restaurante, el Restaurante asume la custodia total y el <strong>riesgo absoluto de pérdida, robo, deterioro o daño</strong>.</li>
                                        <li><strong>Exclusión Total por Daños Físicos y Operativos:</strong> <strong>Exo Advance LLC NO se hace responsable bajo ninguna circunstancia</strong> por daños físicos, pantallas rotas o estrelladas, caídas, golpes, derrames de líquidos, exposición a grasa, vapor o calor extremo de cocina, sobrecargas o fluctuaciones eléctricas, cortocircuitos, desgaste por uso diario, manipulación indebida o negligente por parte del personal o de los comensales, vandalismo o hurto de los equipos.</li>
                                        <li><strong>Entrega "TAL CUAL" ("AS IS") y Garantía Exclusiva del Fabricante (Fla. Stat. § 672.316):</strong> DE CONFORMIDAD CON EL CÓDIGO COMERCIAL UNIFORME DE FLORIDA (UCC, FLA. STAT. § 672.316), TODO HARDWARE O EQUIPO FÍSICO SUMINISTRADO, VENDIDO O INSTALADO SE ENTREGA <strong>"TAL CUAL" ("AS IS") Y "CON TODOS SUS DEFECTOS"</strong>. EXO ADVANCE LLC NO ES FABRICANTE DE HARDWARE Y RENUNCIA EXPRESAMENTE A TODA GARANTÍA EXPRESA O IMPLÍCITA SOBRE LOS EQUIPOS FÍSICOS, INCLUYENDO CUALQUIER GARANTÍA IMPLÍCITA DE <strong>COMERCIABILIDAD (MERCHANTABILITY)</strong> O <strong>APTITUD PARA UN PROPÓSITO PARTICULAR</strong>. Cualquier reclamo por defecto de fábrica deberá tramitarse única y directamente ante el fabricante original del equipo (OEM).</li>
                                        <li><strong>Costo de Reposición y Continuidad de Suscripción:</strong> Toda reparación, mantenimiento físico o reemplazo de hardware dañado, averiado o extraviado correrá al cien por ciento (100%) por cuenta y cargo exclusivo del Restaurante. La avería, daño o falta de funcionamiento de un equipo físico no exime al Restaurante de su obligación de pago puntual de la suscripción mensual del Software ni genera derecho a reembolsos o créditos.</li>
                                    </ul>

                                    <h3 className="font-black text-slate-900 pt-2 text-base">8. Exclusión de Garantías y Límite de Responsabilidad</h3>
                                    <p>
                                        EL SERVICIO Y CUALQUIER HARDWARE ASOCIADO SE PROPORCIONAN "TAL CUAL" ("AS IS") Y "SEGÚN DISPONIBILIDAD" ("AS AVAILABLE"). EN LA MÁXIMA MEDIDA PERMITIDA POR LAS LEYES DE FLORIDA, EXO ADVANCE LLC (ORDERPOINT) RENUNCIA A TODA GARANTÍA IMPLÍCITA DE COMERCIABILIDAD, APTITUD PARA UN PROPÓSITO ESPECÍFICO O CONTINUIDAD ININTERRUMPIDA. EXO ADVANCE LLC RESPONDE ÚNICAMENTE POR SU PLATAFORMA DE SOFTWARE SAAS Y NO ASUME RESPONSABILIDAD ALGUNA POR DAÑOS A EQUIPOS FÍSICOS O HARDWARE. EN NINGÚN CASO LA RESPONSABILIDAD TOTAL ACUMULADA DE EXO ADVANCE LLC EXCEDERÁ EL MONTO TOTAL ABONADO POR EL CLIENTE EXCLUSIVAMENTE EN CONCEPTO DE SUSCRIPCIÓN MENSUAL DEL SOFTWARE EN LOS TRES (3) MESES ANTERIORES AL RECLAMO (EXCLUYENDO CUALQUIER PAGO POR HARDWARE O INSTALACIÓN).
                                    </p>

                                    <h3 className="font-black text-slate-900 pt-2 text-base">9. Indemnización</h3>
                                    <p>
                                        El Restaurante acepta defender, indemnizar y mantener indemne a Exo Advance LLC (OrderPoint), sus desarrolladores, directores, socios y empleados frente a cualquier demanda, pérdida, costo o reclamo de terceros derivado de la operación comercial del restaurante, daños o accidentes causados por el uso de equipos físicos o soportes en el local, calidad de los alimentos, disputas laborales internas (ej. propinas o nómina) o incumplimiento tributario.
                                    </p>

                                    <h3 className="font-black text-slate-900 pt-2 text-base">10. Ley Aplicable, Jurisdicción y Renuncia a Juicio por Jurado</h3>
                                    <p>
                                        Este Contrato se rige por las leyes del <strong>Estado de Florida, EE. UU.</strong>, con jurisdicción exclusiva en los tribunales estatales o federales correspondientes al Estado de Florida. <strong>AMBAS PARTES RENUNCIAN IRREVOCABLEMENTE A CUALQUIER DERECHO A JUICIO POR JURADO</strong> en relación con cualquier litigio derivado de este contrato, y acuerdan resolver cualquier diferendo de forma individual, renunciando expresamente a participar en demandas colectivas (Class Action Waiver).
                                    </p>

                                    <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-500 uppercase tracking-widest text-center">
                                        Versión v2.0 (Florida Law Compliance) • Exo Advance LLC • Actualización: Octubre 2026
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                                        <p className="text-xs font-black text-emerald-800 uppercase tracking-wider mb-1">
                                            Legal Notice & Governing Law (State of Florida, USA)
                                        </p>
                                        <p className="text-xs text-slate-700">
                                            This B2B Software as a Service (SaaS) Agreement is governed by the laws of the State of Florida, USA. By activating your restaurant Owner account, you enter into a legally binding contract between your establishment and <strong>Exo Advance LLC</strong> (the owning company and provider of the <strong>OrderPoint</strong> software platform).
                                        </p>
                                    </div>

                                    <h3 className="font-black text-slate-900 pt-2 text-base">1. Acceptance and Electronic Execution</h3>
                                    <p>
                                        By checking the "I have read and accept the Terms & Conditions" box and submitting this form, you acknowledge and agree that your action constitutes a legally binding electronic signature under the <strong>Florida Uniform Electronic Transaction Act (Fla. Stat. § 668.50)</strong> and the Federal Electronic Signatures in Global and National Commerce Act (E-SIGN, 15 U.S.C. § 7001).
                                    </p>

                                    <h3 className="font-black text-slate-900 pt-2 text-base">2. B2B SaaS Software License</h3>
                                    <p>
                                        OrderPoint grants the Restaurant a limited, revocable, non-exclusive, and non-transferable license to access the cloud software platform during the active subscription period. Services include: Self-service touchscreen Kiosk, real-time Kitchen Display System (KDS), mobile waiter ordering (Exo Server), catalog and QR menu management, and ESC/POS thermal printing integrations.
                                    </p>

                                    <h3 className="font-black text-slate-900 pt-2 text-base">3. Restaurant Operations, Food Safety & Allergens (Florida DBPR & DOH)</h3>
                                    <p>
                                        The Restaurant and its management retain sole and absolute responsibility for:
                                    </p>
                                    <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600">
                                        <li>Food storage, preparation, heating temperatures, sanitary practices, and quality under the regulatory authority of the <strong>Florida Department of Business and Professional Regulation (DBPR)</strong> and the <strong>Florida Department of Health</strong>.</li>
                                        <li>The accuracy of menu ingredients, pricing, allergen notices (peanuts, shellfish, dairy, gluten, etc.), and consumer advisories regarding raw or undercooked foods.</li>
                                        <li>OrderPoint is strictly a technology platform provider and <strong>disclaims all liability</strong> for foodborne illness, allergic reactions, customer disputes, or dining room incidents.</li>
                                    </ul>

                                    <h3 className="font-black text-slate-900 pt-2 text-base">4. Subscriptions, Recurring Billing (Stripe) & Florida Taxes</h3>
                                    <p>
                                        Software licensing and subscription fees are billed automatically through Stripe. With respect to customer food and drink transactions:
                                    </p>
                                    <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600">
                                        <li>The Restaurant is the sole Merchant of Record.</li>
                                        <li>The Restaurant is strictly responsible for collecting and remitting Florida Sales and Use Tax (<strong>Fla. Stat. Chapter 212</strong>) to the Florida Department of Revenue.</li>
                                    </ul>

                                    <h3 className="font-black text-slate-900 pt-2 text-base">5. Data Protection and Privacy (Florida FIPA)</h3>
                                    <p>
                                        OrderPoint maintains industry-standard security controls under the <strong>Florida Information Protection Act (FIPA, Fla. Stat. § 501.171)</strong> and PCI-DSS compliance standards. We do not store cardholder account numbers on our servers. The Restaurant retains full ownership of its menu data, customer lists, and transaction history.
                                    </p>

                                    <h3 className="font-black text-slate-900 pt-2 text-base">6. Artificial Intelligence Services (Google Gemini)</h3>
                                    <p>
                                        OrderPoint integrates AI models for automated translations and operations. AI features are provided "AS IS". The Restaurant must independently verify all AI-translated menu descriptions, allergen alerts, and prices before publishing them.
                                    </p>

                                    <h3 className="font-black text-slate-900 pt-2 text-base">7. Physical Hardware, Equipment & Peripherals — Complete Disclaimer of Liability for Damages (Fla. Stat. §§ 672.316 & 672.509)</h3>
                                    <p>
                                        <strong>Exo Advance LLC (OrderPoint)</strong> is strictly and exclusively a <strong>Software-as-a-Service (SaaS)</strong> provider. Accordingly, the company&apos;s support, maintenance, and warranty obligations apply <strong>solely and exclusively to the cloud Software platform</strong>, and any physical equipment is governed by the following Florida commercial law provisions:
                                    </p>
                                    <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600">
                                        <li><strong>Transfer of Risk of Loss & Custody (Fla. Stat. § 672.509):</strong> Immediately upon physical delivery or installation of any hardware or equipment at the Restaurant&apos;s premises (including Self-Service Kiosk tablets, Kitchen Display System [KDS] monitors/screens, waiter mobile devices, Bluetooth/ESC-POS thermal printers, stands, mounts, cables, power adapters, or routers), the Restaurant assumes full custody and bears the <strong>entire risk of loss, theft, deterioration, or damage</strong>.</li>
                                        <li><strong>Zero Liability for Physical or Operational Hardware Damages:</strong> <strong>Exo Advance LLC SHALL NOT BE LIABLE UNDER ANY CIRCUMSTANCES</strong> for physical damages, cracked or broken screens, drops, impacts, liquid or beverage spills, kitchen grease, steam, extreme heat exposure, electrical power surges, voltage fluctuations, short circuits, normal wear and tear, improper or negligent handling by Restaurant staff or patrons, vandalism, or theft of any hardware.</li>
                                        <li><strong>Conspicuous "AS-IS" Hardware Disclaimer & OEM Warranty Only (Fla. Stat. § 672.316):</strong> PURSUANT TO THE FLORIDA UNIFORM COMMERCIAL CODE (UCC, FLA. STAT. § 672.316), ANY HARDWARE OR PHYSICAL EQUIPMENT SOLD, SUPPLIED, OR INSTALLED IS PROVIDED STRICTLY <strong>"AS IS" AND "WITH ALL FAULTS"</strong>. EXO ADVANCE LLC IS NOT A HARDWARE MANUFACTURER AND EXPRESSLY DISCLAIMS ALL EXPRESS OR IMPLIED WARRANTIES REGARDING PHYSICAL HARDWARE, INCLUDING ANY IMPLIED WARRANTIES OF <strong>MERCHANTABILITY</strong> OR <strong>FITNESS FOR A PARTICULAR PURPOSE</strong>. Any warranty claims for manufacturing defects must be directed solely to the Original Equipment Manufacturer (OEM).</li>
                                        <li><strong>Replacement Costs & Uninterrupted SaaS Subscription:</strong> The Restaurant is one hundred percent (100%) responsible for the repair, maintenance, or replacement cost of any damaged, malfunctioning, or lost hardware. Hardware damage, malfunction, or unavailability shall never relieve the Restaurant of its ongoing monthly SaaS Software subscription payment obligations nor entitle the Restaurant to any refunds or credits.</li>
                                    </ul>

                                    <h3 className="font-black text-slate-900 pt-2 text-base">8. Disclaimer of Warranties and Limitation of Liability</h3>
                                    <p>
                                        THE SOFTWARE SERVICES AND ANY ASSOCIATED HARDWARE ARE PROVIDED "AS IS" AND "AS AVAILABLE". TO THE MAXIMUM EXTENT PERMITTED BY FLORIDA LAW, EXO ADVANCE LLC (ORDERPOINT) DISCLAIMS ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. EXO ADVANCE LLC IS SOLELY RESPONSIBLE FOR ITS CLOUD SOFTWARE PLATFORM AND ASSUMES ZERO LIABILITY FOR PHYSICAL HARDWARE DAMAGES OR FAILURES. IN NO EVENT SHALL EXO ADVANCE LLC&apos;S AGGREGATE LIABILITY EXCEED THE TOTAL SAAS SUBSCRIPTION FEES ACTUALLY PAID BY THE RESTAURANT EXCLUSIVELY FOR THE SOFTWARE IN THE THREE (3) MONTHS PRECEDING THE CLAIM (EXCLUDING ANY HARDWARE OR INSTALLATION FEES).
                                    </p>

                                    <h3 className="font-black text-slate-900 pt-2 text-base">9. Indemnification</h3>
                                    <p>
                                        The Restaurant agrees to defend, indemnify, and hold harmless Exo Advance LLC (OrderPoint), its developers, directors, members, and agents from any third-party claims, liabilities, property damage, bodily injury, or expenses resulting from food service operations, physical equipment placement or use on the premises, staff disputes (e.g. tips or wages), tax non-compliance, or violation of these Terms.
                                    </p>

                                    <h3 className="font-black text-slate-900 pt-2 text-base">10. Governing Law, Venue & Waiver of Jury Trial</h3>
                                    <p>
                                        This Agreement is governed by the laws of the <strong>State of Florida, United States</strong>, with exclusive jurisdiction in the courts located in Florida. <strong>BOTH PARTIES KNOWINGLY AND VOLUNTARILY WAIVE ANY RIGHT TO A TRIAL BY JURY</strong> in any proceeding relating to this agreement, and agree to resolve claims solely on an individual basis, waiving participation in class action suits (Class Action Waiver).
                                    </p>

                                    <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-500 uppercase tracking-widest text-center">
                                        Version v2.0 (Florida Law Compliance) • Exo Advance LLC • Last Updated: October 2026
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
