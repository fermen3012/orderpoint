'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
    CreditCard,
    Calendar,
    ExternalLink,
    Download,
    Receipt
} from 'lucide-react';
import { getOwnerBilling, getCustomerInvoices, generatePortalLink, BillingCustomer } from '@/actions/stripe-admin';
import { formatPrice } from '@/lib/utils';
import { useAuth } from '@/components/auth/AuthContext';

export default function BillingPage() {
    const t = useTranslations('admin');
    const { restaurantId } = useAuth();
    const [billingInfo, setBillingInfo] = useState<BillingCustomer | null>(null);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingPortal, setLoadingPortal] = useState(false);

    useEffect(() => {
        if (restaurantId) {
            loadBillingData();
        }
    }, [restaurantId]);

    const loadBillingData = async () => {
        setLoading(true);
        try {
            if (!restaurantId) return;
            const data = await getOwnerBilling(restaurantId);
            setBillingInfo(data);

            if (data?.stripe_customer_id) {
                const inv = await getCustomerInvoices();
                setInvoices(inv);
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

    return (
        <div className="space-y-10 animate-in fade-in duration-700 max-w-5xl mx-auto">
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

                <button
                    onClick={handleOpenPortal}
                    disabled={loadingPortal || !billingInfo.stripe_customer_id}
                    className="group relative flex items-center justify-center gap-3 px-10 py-4 bg-emerald-500 text-slate-900 rounded-2xl font-black uppercase tracking-widest shadow-[0_10px_20px_rgba(16,185,129,0.2)] hover:-translate-y-1 transition-all active:scale-95 w-full lg:w-auto disabled:opacity-50 disabled:hover:translate-y-0"
                >
                    <ExternalLink className="w-5 h-5" />
                    <span>{loadingPortal ? t('processing') : t('stripePortal')}</span>
                </button>
            </div>

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
        </div>
    );
}
