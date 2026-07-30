'use client';

import { Suspense, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import {
    CreditCard,
    Calendar,
    ExternalLink,
    Download,
    Receipt,
    QrCode,
    Printer,
    Copy,
    Check
} from 'lucide-react';
import { getOwnerBilling, getCustomerInvoices, generatePortalLink, BillingCustomer } from '@/actions/stripe-admin';
import { createCheckoutSession } from '@/app/actions/stripe';
import { formatPrice } from '@/lib/utils';
import { useAuth } from '@/components/auth/AuthContext';
import { createClient } from '@/lib/supabase/browser';
import { useLocale } from 'next-intl';

function BillingPageContent() {
    const t = useTranslations('admin');
    const { restaurantId } = useAuth();
    const searchParams = useSearchParams();
    const locale = useLocale();
    const supabase = createClient();
    
    const [billingInfo, setBillingInfo] = useState<BillingCustomer | null>(null);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingPortal, setLoadingPortal] = useState(false);
    const [submittingCheckout, setSubmittingCheckout] = useState(false);
    const [restaurantName, setRestaurantName] = useState<string>('');
    const [copied, setCopied] = useState(false);

    const success = searchParams.get('success') === 'true';
    const canceled = searchParams.get('canceled') === 'true';

    useEffect(() => {
        if (restaurantId) {
            loadBillingData();
        }
    }, [restaurantId]);

    const loadBillingData = async () => {
        setLoading(true);
        try {
            if (!restaurantId) return;
            
            // Fetch billing details
            const data = await getOwnerBilling(restaurantId);
            setBillingInfo(data);

            if (data?.stripe_customer_id) {
                const inv = await getCustomerInvoices();
                setInvoices(inv);
            }

            // Fetch restaurant name for the QR code display using casting to bypass TS missing table types
            const { data: restData } = await (supabase.from('restaurants') as any)
                .select('name')
                .eq('id', restaurantId)
                .single();
            if (restData) {
                setRestaurantName(restData.name);
            }
        } catch (error) {
            console.error('Failed to load billing data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenPortal = async () => {
        if (!billingInfo?.stripe_customer_id) return;
        setLoadingPortal(true);
        try {
            const url = await generatePortalLink();
            if (url) {
                window.location.href = url; // Redirect instead of open new window to avoid pop-up blockers
            } else {
                alert('Could not generate portal link');
            }
        } finally {
            setLoadingPortal(false);
        }
    };

    const handleSubscribe = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!restaurantId) return;
        setSubmittingCheckout(true);
        try {
            await createCheckoutSession(restaurantId);
        } catch (error: any) {
            // Check if it is a NextJS redirect error (which is expected)
            if (error?.message === 'NEXT_REDIRECT' || error?.digest?.startsWith('NEXT_REDIRECT')) {
                return;
            }
            console.error('Checkout error:', error);
            alert('Error al iniciar el proceso de pago. Por favor, intente de nuevo.');
        } finally {
            setSubmittingCheckout(false);
        }
    };

    const menuUrl = typeof window !== 'undefined' && restaurantId
        ? `${window.location.origin}/${locale}/menu/${restaurantId}`
        : '';
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(menuUrl)}`;

    const handleCopyLink = () => {
        if (!menuUrl) return;
        navigator.clipboard.writeText(menuUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handlePrintQR = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                <head>
                    <title>Imprimir QR - ${restaurantName || 'Menú'}</title>
                    <style>
                        body {
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            height: 90vh;
                            margin: 0;
                            font-family: system-ui, -apple-system, sans-serif;
                            background-color: white;
                            color: black;
                            text-align: center;
                        }
                        .qr-container {
                            border: 4px solid black;
                            padding: 20px;
                            border-radius: 24px;
                            background: white;
                            box-shadow: 0 10px 30px rgba(0,0,0,0.05);
                        }
                        img {
                            width: 320px;
                            height: 320px;
                            display: block;
                        }
                        h1 {
                            margin-top: 25px;
                            font-size: 28px;
                            font-weight: 900;
                            text-transform: uppercase;
                            letter-spacing: -1px;
                            font-style: italic;
                        }
                        p {
                            font-size: 14px;
                            font-weight: 700;
                            color: #666;
                            margin-top: 5px;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                        }
                    </style>
                </head>
                <body>
                    <div class="qr-container">
                        <img src="${qrImageUrl}" />
                    </div>
                    <h1>${restaurantName || 'Menú Digital'}</h1>
                    <p>Escanea para ver nuestro menú</p>
                    <script>
                        window.onload = function() {
                            window.print();
                            setTimeout(function() { window.close(); }, 500);
                        };
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Cargando Facturación...</p>
            </div>
        );
    }

    if (!billingInfo) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Receipt className="w-16 h-16 text-slate-800" />
                <p className="text-slate-500 font-black uppercase tracking-widest text-sm">Información no disponible</p>
            </div>
        );
    }

    const hasActiveSubscription = !!billingInfo.stripe_subscription_id;

    return (
        <div className="space-y-10 animate-in fade-in duration-700 max-w-5xl mx-auto">
            {/* Success and Canceled Banners */}
            {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-6 rounded-[2rem] font-black uppercase tracking-wider text-xs flex items-center gap-3 animate-in slide-in-from-top-4 duration-500">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    {t('subscriptionSuccess')}
                </div>
            )}
            {canceled && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-[2rem] font-black uppercase tracking-wider text-xs flex items-center gap-3 animate-in slide-in-from-top-4 duration-500">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                    {t('subscriptionCanceled')}
                </div>
            )}

            {/* Header Section */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-8 h-1 bg-emerald-500 rounded-full"></span>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">{t('billingAndPayments')}</span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        {t('billing')}
                    </h1>
                </div>

                {hasActiveSubscription && (
                    <button
                        onClick={handleOpenPortal}
                        disabled={loadingPortal || !billingInfo.stripe_customer_id}
                        className="group relative flex items-center justify-center gap-3 px-10 py-4 bg-emerald-500 text-slate-900 rounded-2xl font-black uppercase tracking-widest shadow-[0_10px_20px_rgba(16,185,129,0.2)] hover:-translate-y-1 transition-all active:scale-95 w-full lg:w-auto disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                        <ExternalLink className="w-5 h-5" />
                        <span>{loadingPortal ? t('processing') : t('stripePortal')}</span>
                    </button>
                )}
            </div>

            {/* QR Menu Card Section */}
            {restaurantId && (
                <div className="bg-slate-900/40 backdrop-blur-sm rounded-[3rem] p-10 border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-10 animate-in fade-in duration-500">
                    {/* Background glows */}
                    <div className="absolute -top-24 -left-24 w-48 h-48 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />

                    <div className="flex-1 space-y-4 text-center md:text-left w-full">
                        <div className="flex items-center gap-2 justify-center md:justify-start">
                            <span className="w-8 h-1 bg-orange-500 rounded-full"></span>
                            <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em]">Acceso Comensales</span>
                        </div>
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
                            Menú QR Digital
                        </h2>
                        <p className="text-slate-400 font-medium text-sm leading-relaxed max-w-xl">
                            Descarga e imprime el código QR para colocarlo en las mesas de tu restaurante. Tus comensales podrán escanearlo para visualizar el menú digital de forma instantánea y Mobile-First en sus teléfonos, sin necesidad de registro o descargas.
                        </p>

                        <div className="mt-6 flex flex-col sm:flex-row gap-3 max-w-xl w-full pt-2">
                            <div className="flex-1 bg-slate-950 px-4 py-3.5 rounded-2xl border border-slate-800/80 font-mono text-xs text-slate-400 select-all truncate flex items-center justify-start">
                                {menuUrl}
                            </div>
                            <button
                                onClick={handleCopyLink}
                                className="px-6 py-3.5 bg-slate-800 hover:bg-slate-750 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 border border-slate-700/50"
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-4 h-4 text-emerald-500 animate-in zoom-in-50" />
                                        <span className="text-emerald-500">Copiado</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4 text-slate-400" />
                                        <span>Copiar Link</span>
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="mt-6 flex flex-wrap gap-4 pt-2 justify-center md:justify-start">
                            <button
                                onClick={handlePrintQR}
                                className="flex items-center gap-2.5 px-8 py-4 bg-orange-500 hover:bg-orange-400 text-slate-950 rounded-2xl font-black uppercase tracking-widest text-xs shadow-[0_10px_20px_rgba(249,115,22,0.2)] hover:-translate-y-0.5 transition-all active:scale-95"
                            >
                                <Printer className="w-4 h-4 text-slate-950" />
                                <span>Imprimir Código QR</span>
                            </button>
                            <a
                                href={menuUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2.5 px-8 py-4 bg-slate-950 hover:bg-slate-900 text-slate-300 rounded-2xl font-black uppercase tracking-widest text-xs hover:-translate-y-0.5 transition-all active:scale-95 border border-slate-800"
                            >
                                <ExternalLink className="w-4 h-4 text-slate-400" />
                                <span>Ver Menú Público</span>
                            </a>
                        </div>
                    </div>

                    <div className="flex-shrink-0 flex flex-col items-center gap-3 w-full md:w-auto">
                        <div className="relative p-6 bg-white rounded-[2rem] border-4 border-slate-800 shadow-xl flex items-center justify-center animate-in zoom-in-95 duration-500">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={qrImageUrl} alt="QR Menu" className="w-44 h-44 object-contain" />
                        </div>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">
                            Código de Mesa General
                        </span>
                    </div>
                </div>
            )}

            {hasActiveSubscription ? (
                <>
                    {/* Plan Overview Card */}
                    <div className="bg-slate-900/40 backdrop-blur-sm rounded-[3rem] p-10 border border-slate-800 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-10">
                            <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-lg ${billingInfo.subscription_status === 'active'
                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                    : billingInfo.subscription_status === 'past_due'
                                        ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                }`}>
                                {billingInfo.subscription_status === 'active' ? t('activeSub') : billingInfo.subscription_status === 'past_due' ? t('pastDueSub') : billingInfo.subscription_status}
                            </span>
                        </div>

                        <div className="flex items-center gap-6 mb-10">
                            <div className="w-20 h-20 rounded-[1.5rem] bg-slate-950 flex items-center justify-center border border-slate-800 shadow-xl">
                                <CreditCard className="w-8 h-8 text-emerald-500" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none mb-2">
                                    {t('planDetails')}
                                </h2>
                                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">
                                    {billingInfo.name}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-slate-950/50 p-8 rounded-3xl border border-slate-800/50 flex flex-col gap-2">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-slate-700"></span>
                                    {t('currentQuota')}
                                </span>
                                <div className="flex items-end gap-2">
                                    <span className="text-5xl font-black text-white italic tracking-tighter">{billingInfo.plan_quantity}</span>
                                    <span className="text-sm font-black text-slate-600 uppercase tracking-widest mb-1">KIOSCOS</span>
                                </div>
                            </div>

                            <div className="bg-slate-950/50 p-8 rounded-3xl border border-slate-800/50 flex flex-col gap-2">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    {t('monthlyAmount')}
                                </span>
                                <div className="flex items-end gap-2">
                                    <span className="text-5xl font-black text-white italic tracking-tighter">{formatPrice(billingInfo.mrr, billingInfo.currency || 'USD')}</span>
                                    <span className="text-sm font-black text-slate-600 uppercase tracking-widest mb-1">/ MES</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Invoices Section */}
                    <div>
                        <div className="flex items-center gap-3 mb-6 px-2">
                            <Calendar className="w-5 h-5 text-emerald-500" />
                            <h3 className="text-xl font-black text-white italic tracking-tighter uppercase">
                                {t('paymentHistory')}
                            </h3>
                        </div>

                        <div className="bg-slate-900/40 backdrop-blur-sm rounded-[3rem] border border-slate-800 shadow-2xl overflow-hidden">
                            {invoices.length === 0 ? (
                                <div className="p-20 text-center">
                                    <Receipt className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                                    <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">{t('noInvoicesFound')}</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-800/50">
                                    {invoices.map((inv) => (
                                        <div key={inv.id} className="p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-slate-800/20 transition-colors group">
                                            <div className="flex items-center gap-6">
                                                <div className="w-12 h-12 rounded-2xl bg-slate-950 flex items-center justify-center border border-slate-800 group-hover:border-emerald-500/30 transition-all">
                                                    <Receipt className="w-5 h-5 text-slate-600 group-hover:text-emerald-500 transition-colors" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <span className="font-black text-white text-xl italic tracking-tighter uppercase">{inv.amount} {inv.currency}</span>
                                                        <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                                            }`}>
                                                            {inv.status === 'paid' ? t('paid') : inv.status}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                        {inv.date} &bull; {inv.number}
                                                    </p>
                                                </div>
                                            </div>

                                            {inv.pdf_url && (
                                                <a
                                                    href={inv.pdf_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="px-6 py-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/30 text-slate-400 hover:text-emerald-500 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95"
                                                >
                                                    <Download className="w-4 h-4" />
                                                    {t('downloadInvoice')}
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                /* Unsubscribed State - Setup Payment Card */
                <div className="bg-slate-900/40 backdrop-blur-sm rounded-[3rem] p-10 border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-8 animate-in zoom-in-95 duration-500">
                    <div className="space-y-4 max-w-2xl text-center md:text-left">
                        <div className="flex items-center gap-2 justify-center md:justify-start">
                            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>
                            <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em]">{t('subscriptionStatus')}</span>
                        </div>
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
                            {t('noSubscriptionTitle')}
                        </h2>
                        <p className="text-slate-400 text-sm font-medium leading-relaxed">
                            {t('noSubscriptionDesc')}
                        </p>
                    </div>

                    <form onSubmit={handleSubscribe} className="w-full md:w-auto">
                        <button
                            type="submit"
                            disabled={submittingCheckout}
                            className="group relative flex items-center justify-center gap-3 px-10 py-5 bg-orange-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-[0_10px_20px_rgba(249,115,22,0.2)] hover:-translate-y-1 transition-all active:scale-95 w-full disabled:opacity-50 disabled:hover:translate-y-0"
                        >
                            <CreditCard className="w-5 h-5 text-white" />
                            <span>{submittingCheckout ? t('processing') : t('subscribeNow')}</span>
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}

export default function BillingPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Cargando Facturación...</p>
            </div>
        }>
            <BillingPageContent />
        </Suspense>
    );
}

