'use client';

import { useState, useTransition, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    Search, Users, MoreHorizontal, Download, ExternalLink,
    CreditCard, Calendar, CheckCircle, AlertTriangle, ChevronDown
} from 'lucide-react';
import {
    getAllCustomersBilling,
    updateSubscriptionQuantity,
    getCustomerInvoices,
    generatePortalLink,
    BillingCustomer
} from '@/actions/stripe-admin';
import { formatPrice } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';

export default function SuperAdminBillingPage() {
    const [customers, setCustomers] = useState<BillingCustomer[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCustomer, setSelectedCustomer] = useState<BillingCustomer | null>(null);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        const load = async () => {
            try {
                const data = await getAllCustomersBilling();
                setCustomers(data);
            } catch (err) {
                console.error('Error loading billing data', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const onUpdateQuantity = async (customer: BillingCustomer, newQty: number) => {
        if (newQty < 1) return;

        setCustomers(prev => prev.map(c =>
            c.id === customer.id ? { ...c, plan_quantity: newQty } : c
        ));

        try {
            const res = await updateSubscriptionQuantity(customer.id, newQty);
            if (!res.success) {
                throw new Error(res.error);
            }
        } catch (err) {
            setCustomers(prev => prev.map(c =>
                c.id === customer.id ? { ...c, plan_quantity: customer.plan_quantity } : c
            ));
            alert('Error al actualizar la suscripción');
        }
    };

    const openDetails = async (customer: BillingCustomer) => {
        setSelectedCustomer(customer);
        setLoadingInvoices(true);
        if (customer.stripe_customer_id) {
            const data = await getCustomerInvoices(customer.stripe_customer_id);
            setInvoices(data);
        } else {
            setInvoices([]);
        }
        setLoadingInvoices(false);
    };

    const handleOpenPortal = async () => {
        if (!selectedCustomer?.stripe_customer_id) return;
        const url = await generatePortalLink(selectedCustomer.stripe_customer_id);
        if (url) window.open(url, '_blank');
        else alert('No se pudo generar el enlace al portal');
    };

    const searchParamsHook = useSearchParams();

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes((searchParamsHook.get('q') || '').toLowerCase())
    );

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-8 h-1 bg-emerald-500 rounded-full"></span>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Gestión Financiera Central</span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        Facturación de Restaurantes
                    </h1>
                </div>

                <div className="relative group w-full lg:w-96">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="BUSCAR RESTAURANTE..."
                        className="w-full pl-16 pr-8 py-5 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-[2rem] focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-white text-xs uppercase tracking-widest shadow-inner placeholder:text-slate-700"
                    // In a real application, you'd use usePathname + useRouter to update URL search params
                    />
                </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <MetricCard
                    title="Ingreso Recurrente (MRR)"
                    value={formatPrice(customers.reduce((acc, c) => acc + (c.mrr || 0), 0), 'en-US')}
                    icon={<CreditCard className="w-8 h-8 text-emerald-500" />}
                    trend="+12% VS MES PASADO"
                />
                <MetricCard
                    title="Suscripciones Activas"
                    value={customers.filter(c => c.subscription_status === 'active').length.toString()}
                    icon={<CheckCircle className="w-8 h-8 text-emerald-500" />}
                    trend="SISTEMA OPERATIVO"
                />
                <MetricCard
                    title="Pagos Atrasados"
                    value={customers.filter(c => c.subscription_status === 'past_due').length.toString()}
                    icon={<AlertTriangle className="w-8 h-8 text-red-500" />}
                    trend="REQUIERE REVISIÓN"
                    isAlert
                />
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block bg-slate-900/40 backdrop-blur-sm rounded-[3.5rem] border border-slate-800 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full">
                        <thead className="bg-slate-950/20 border-b border-slate-800/50">
                            <tr>
                                <th className="px-12 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-left">Restaurante Cliente</th>
                                <th className="px-12 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-left">Estado Suscripción</th>
                                <th className="px-12 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-left">Ingreso Mensual</th>
                                <th className="px-12 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-center">Nº Quioscos</th>
                                <th className="px-12 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-right">Opciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-12 py-8"><div className="h-6 w-48 bg-slate-800 rounded"></div></td>
                                        <td className="px-12 py-8"><div className="h-6 w-24 bg-slate-800 rounded"></div></td>
                                        <td className="px-12 py-8"><div className="h-6 w-20 bg-slate-800 rounded"></div></td>
                                        <td className="px-12 py-8"><div className="h-8 w-24 bg-slate-800 rounded mx-auto"></div></td>
                                        <td className="px-12 py-8"><div className="h-8 w-8 bg-slate-800 rounded ml-auto"></div></td>
                                    </tr>
                                ))
                            ) : (
                                filteredCustomers.map((customer) => (
                                    <tr key={customer.id} className="group hover:bg-slate-800/20 transition-all duration-300">
                                        <td className="px-12 py-8">
                                            <div className="flex items-center gap-6">
                                                <div className="w-14 h-14 rounded-[1.25rem] bg-slate-950 flex items-center justify-center border border-slate-800 group-hover:border-emerald-500/30 transition-all duration-500 shadow-xl">
                                                    <span className="font-black text-slate-700 text-xl group-hover:text-emerald-500 transition-colors uppercase">
                                                        {customer.name.substring(0, 1)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="font-black text-white text-xl italic tracking-tighter uppercase group-hover:text-emerald-500 transition-colors">
                                                        {customer.name}
                                                    </p>
                                                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-1">
                                                        {customer.email || 'SIN CORREO ASIGNADO'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-12 py-8">
                                            <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-lg ${customer.subscription_status === 'active'
                                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                    : customer.subscription_status === 'past_due'
                                                        ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                                }`}>
                                                {customer.subscription_status}
                                            </span>
                                        </td>
                                        <td className="px-12 py-8">
                                            <span className="flex items-end gap-1 font-black text-white text-2xl italic tracking-tighter uppercase">
                                                {formatPrice(customer.mrr || 0, 'en-US')}
                                                <span className="text-[10px] text-slate-600 uppercase tracking-widest leading-6">/MES</span>
                                            </span>
                                        </td>
                                        <td className="px-12 py-8">
                                            <div className="flex items-center justify-center gap-4 bg-slate-900/50 w-max mx-auto p-2 rounded-2xl border border-slate-800">
                                                <button
                                                    onClick={() => onUpdateQuantity(customer, (customer.plan_quantity || 0) - 1)}
                                                    className="w-10 h-10 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-500 hover:text-white flex items-center justify-center active:scale-95 transition-all disabled:opacity-50 disabled:hover:bg-slate-950 shadow-inner"
                                                    disabled={customer.plan_quantity <= 1}
                                                >
                                                    <span className="text-xl font-bold leading-none -mt-1">-</span>
                                                </button>
                                                <span className="w-10 text-center font-black text-2xl text-white italic tracking-tighter">{customer.plan_quantity}</span>
                                                <button
                                                    onClick={() => onUpdateQuantity(customer, (customer.plan_quantity || 0) + 1)}
                                                    className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-900 hover:-translate-y-1 active:scale-95 transition-all shadow-lg flex items-center justify-center"
                                                >
                                                    <span className="text-xl font-black leading-none -mt-1">+</span>
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-12 py-8 text-right">
                                            <button
                                                onClick={() => openDetails(customer)}
                                                className="p-5 bg-slate-800 hover:bg-emerald-500 text-slate-400 hover:text-slate-900 rounded-2xl transition-all shadow-xl group-hover:scale-110 translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 ml-auto flex items-center gap-2"
                                            >
                                                <span className="text-[8px] font-black uppercase tracking-widest hidden lg:block">Gestionar</span>
                                                <MoreHorizontal className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Empty UI Check */}
            {filteredCustomers.length === 0 && !loading && (
                <div className="p-32 text-center bg-slate-900/20 rounded-[3rem] border border-dashed border-slate-800">
                    <CreditCard className="w-16 h-16 text-slate-800 mx-auto mb-6" />
                    <h2 className="text-2xl font-black text-slate-700 uppercase italic tracking-tighter">Sin Suscripciones Encontradas</h2>
                </div>
            )}

            {/* Invoices Dialog */}
            {selectedCustomer && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-500">
                    <div className="bg-slate-900 w-full max-w-3xl rounded-[3.5rem] border border-slate-800 shadow-2xl relative animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col overflow-hidden">

                        {/* Header Dialog */}
                        <div className="p-10 md:p-12 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-md shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <h1 className="text-3xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                                    {selectedCustomer.name}
                                </h1>
                                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px] mt-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Dossier del Cliente
                                </p>
                            </div>

                            <div className="flex items-center gap-4">
                                <button
                                    onClick={handleOpenPortal}
                                    className="px-8 py-5 bg-emerald-500 text-slate-900 rounded-2xl font-black uppercase tracking-widest shadow-[0_10px_20px_rgba(16,185,129,0.2)] hover:-translate-y-1 transition-all active:scale-95 text-[10px] flex items-center gap-3"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Portal Stripe
                                </button>
                                <button
                                    onClick={() => setSelectedCustomer(null)}
                                    className="p-5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl transition-all"
                                >
                                    <span className="text-xl leading-none font-bold">×</span>
                                </button>
                            </div>
                        </div>

                        {/* Body Dialog */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-10 md:p-12">
                            <h3 className="text-xl font-black text-white italic tracking-tighter uppercase mb-6 flex items-center gap-3">
                                <Calendar className="w-5 h-5 text-emerald-500" />
                                Historial de Facturación
                            </h3>

                            <div className="space-y-4">
                                {loadingInvoices ? (
                                    <div className="p-12 text-center text-slate-500 font-black uppercase tracking-widest text-[10px] animate-pulse">
                                        Sincronizando Facturas...
                                    </div>
                                ) : invoices.length === 0 ? (
                                    <div className="p-12 text-center bg-slate-950/50 rounded-3xl border border-slate-800">
                                        <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">No hay recibos emitidos</p>
                                    </div>
                                ) : (
                                    invoices.map((inv) => (
                                        <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-8 rounded-3xl bg-slate-950/50 border border-slate-800 hover:border-emerald-500/30 transition-all group gap-6">
                                            <div>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <p className="text-2xl font-black text-white italic tracking-tighter leading-none">{inv.amount} {inv.currency}</p>
                                                    <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                                                        }`}>
                                                        {inv.status}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                    {inv.date} • REF: {inv.number}
                                                </p>
                                            </div>

                                            {inv.pdf_url && (
                                                <a
                                                    href={inv.pdf_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="px-6 py-4 bg-slate-800 hover:bg-emerald-500 text-slate-400 hover:text-slate-900 rounded-2xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl"
                                                >
                                                    <Download className="w-4 h-4" />
                                                    Download PDF
                                                </a>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function MetricCard({ title, value, icon, trend, isAlert = false }: any) {
    return (
        <div className="bg-slate-900/40 backdrop-blur-sm p-10 rounded-[3rem] border border-slate-800 shadow-2xl relative overflow-hidden group">
            {/* Background Glow */}
            <div className={`absolute -right-8 -top-8 w-32 h-32 rounded-full blur-3xl opacity-20 transition-all duration-700 ${isAlert ? 'bg-red-500 group-hover:bg-red-400' : 'bg-emerald-500 group-hover:bg-teal-400'}`}></div>

            <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between mb-8">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isAlert ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                        {title}
                    </span>
                    <div className="w-16 h-16 bg-slate-950 rounded-[1.25rem] border border-slate-800 flex items-center justify-center shadow-xl">
                        {icon}
                    </div>
                </div>

                <span className="text-5xl lg:text-6xl font-black text-white italic tracking-tighter mb-4">{value}</span>

                <div className="mt-auto">
                    <span className={`px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 ${isAlert ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                        }`}>
                        {trend}
                    </span>
                </div>
            </div>
        </div>
    );
}
