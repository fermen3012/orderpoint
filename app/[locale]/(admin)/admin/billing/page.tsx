'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { adminSupabase } from '@/lib/supabase/admin-client';
import { createClient } from '@/lib/supabase/browser';
import { useAuth } from '@/components/auth/AuthContext';
import { createCheckoutSession, createCustomerPortalSession } from '@/app/actions/stripe';
import {
    CreditCard,
    CheckCircle2,
    XCircle,
    Loader2,
    Calendar,
    ShieldCheck
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';

export default function BillingPage() {
    const t = useTranslations('admin');
    const { restaurantId } = useAuth();
    const searchParams = useSearchParams();
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [restaurant, setRestaurant] = useState<any>(null);
    const [userEmail, setUserEmail] = useState<string>('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (restaurantId) {
            loadData();
        }
    }, [restaurantId]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch restaurant details
            const { data: restaurantData } = await adminSupabase
                .from('restaurants')
                .select('*')
                .eq('id', restaurantId)
                .single();

            if (restaurantData) {
                setRestaurant(restaurantData);
            }

            // Fetch current user email
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
                setUserEmail(user.email);
            }

        } catch (error) {
            console.error('Error loading billing data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubscribe = async () => {
        if (!restaurantId) return;
        setProcessing(true);
        try {
            await createCheckoutSession(restaurantId, userEmail);
        } catch (error) {
            console.error('Error starting subscription:', error);
            alert('Error al iniciar la suscripción. Asegúrate de que el ID de precio de Stripe esté configurado en el servidor.');
            setProcessing(false);
        }
    };

    const handleManageSubscription = async () => {
        if (!restaurant?.stripe_customer_id) return;
        setProcessing(true);
        try {
            await createCustomerPortalSession(restaurant.stripe_customer_id);
        } catch (error) {
            console.error('Error opening portal:', error);
            alert('Error al abrir el panel de facturación.');
            setProcessing(false);
        }
    };

    const isSuccess = searchParams.get('success') === 'true';
    const isCanceled = searchParams.get('canceled') === 'true';

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    const isActive = restaurant?.subscription_status === 'active';
    const periodEnd = restaurant?.current_period_end ? new Date(restaurant.current_period_end) : null;

    return (
        <div className="p-4 md:p-8 lg:p-10">
            <header className="mb-10">
                <h1 className="text-3xl md:text-4xl font-black text-secondary-900 tracking-tight">Facturación & Plan</h1>
                <p className="text-secondary-500 font-bold mt-1 text-sm md:text-base">Gestiona tu suscripción y métodos de pago.</p>
            </header>

            {/* Notifications */}
            {isSuccess && (
                <div className="mb-8 p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center gap-3 text-green-700 animate-in slide-in-from-top-4">
                    <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
                    <div>
                        <p className="font-black text-sm">¡Suscripción exitosa!</p>
                        <p className="text-xs font-medium opacity-90">Gracias por suscribirte a OrderPoint Pro.</p>
                    </div>
                </div>
            )}
            {isCanceled && (
                <div className="mb-8 p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-center gap-3 text-orange-700 animate-in slide-in-from-top-4">
                    <XCircle className="w-6 h-6 flex-shrink-0" />
                    <div>
                        <p className="font-black text-sm">Proceso cancelado</p>
                        <p className="text-xs font-medium opacity-90">No se ha realizado ningún cobro.</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Plan Card */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-[2.5rem] shadow-xl shadow-secondary-900/5 border border-secondary-100 overflow-hidden relative">
                        {/* Decorative Background */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-100/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                        <div className="p-8 md:p-10 relative z-10">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h2 className="text-2xl font-black text-secondary-900 tracking-tight">Plan Actual</h2>
                                        {isActive ? (
                                            <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-black uppercase tracking-widest border border-green-200">
                                                Activo
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-black uppercase tracking-widest border border-slate-200">
                                                Inactivo
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-secondary-500 font-bold">
                                        {isActive ? 'Tienes acceso completo a todas las funciones.' : 'Actualmente estás en el plan gratuito limitado.'}
                                    </p>
                                </div>
                                <div className="text-right hidden md:block">
                                    <p className="text-sm font-black text-secondary-400 uppercase tracking-widest">Precio</p>
                                    <p className="text-3xl font-black text-primary-600">$29.99<span className="text-sm text-secondary-400 font-bold">/mes</span></p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                <div className="p-6 bg-secondary-50 rounded-2xl border border-secondary-100 flex items-start gap-4">
                                    <div className="p-3 bg-white rounded-xl shadow-sm text-primary-500">
                                        <CreditCard className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-secondary-400 uppercase tracking-widest mb-1">Próximo Pago</p>
                                        <p className="text-secondary-900 font-bold">
                                            {periodEnd ? periodEnd.toLocaleDateString('es-ES', { dateStyle: 'long' }) : 'No programado'}
                                        </p>
                                    </div>
                                </div>
                                <div className="p-6 bg-secondary-50 rounded-2xl border border-secondary-100 flex items-start gap-4">
                                    <div className="p-3 bg-white rounded-xl shadow-sm text-primary-500">
                                        <Calendar className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-secondary-400 uppercase tracking-widest mb-1">Estado</p>
                                        <p className="text-secondary-900 font-bold">
                                            {isActive ? 'Renovación Automática' : 'Necesita Acción'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4">
                                {isActive ? (
                                    <button
                                        onClick={handleManageSubscription}
                                        disabled={processing}
                                        className="flex-1 px-8 py-4 bg-secondary-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-70 disabled:translate-y-0"
                                    >
                                        {processing ? 'Procesando...' : 'Gestionar Suscripción'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSubscribe}
                                        disabled={processing}
                                        className="flex-1 px-8 py-4 bg-primary-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary-500/20 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-70 disabled:translate-y-0"
                                    >
                                        {processing ? 'Redirigiendo a Stripe...' : 'Suscribirse Ahora'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Features Card */}
                <div>
                    <div className="bg-secondary-900 text-white rounded-[2.5rem] shadow-xl p-8 md:p-10 h-full flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                        <div className="relative z-10">
                            <h3 className="text-xl font-black tracking-tight mb-2">OrderPoint Pro</h3>
                            <p className="text-secondary-400 font-medium text-sm mb-8">Desbloquea todo el potencial de tu restaurante.</p>

                            <ul className="space-y-6 flex-1">
                                {[
                                    'Menú Digital Ilimitado',
                                    'Gestión de Inventario',
                                    'Panel de Administración Avanzado',
                                    'Soporte Prioritario 24/7',
                                    'Estadísticas y Reportes',
                                    'Múltiples Usuarios y Roles'
                                ].map((feature, i) => (
                                    <li key={i} className="flex items-center gap-3">
                                        <div className="p-1 rounded-full bg-primary-500/20 text-primary-400">
                                            <CheckCircle2 className="w-4 h-4" />
                                        </div>
                                        <span className="font-bold text-sm tracking-wide">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <div className="mt-10 pt-8 border-t border-secondary-800">
                                <div className="flex items-center gap-3 text-secondary-400 text-xs">
                                    <ShieldCheck className="w-5 h-5" />
                                    <span>Pagos seguros procesados por Stripe</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
