'use client';

import { useState, useTransition, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
    Search, Users, MoreHorizontal, Download, ExternalLink,
    CreditCard, Calendar, CheckCircle, XCircle
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
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
// import { toast } from 'sonner'; // Removed

export default function BillingPage() {
    const t = useTranslations('admin');

    // In a real app, this should be fetched inside a Server Component and passed as props
    // For simplicity in this demo, we'll fetch on client mount or use SWR/TanStack Query.
    // However, since we are inside a 'use client' file because of interactivity,
    // we would typically use a parent layout or a wrapper.
    // Let's assume data is passed or fetched.
    // To make it functional immediately, I'll fetch on mount.

    const [customers, setCustomers] = useState<BillingCustomer[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCustomer, setSelectedCustomer] = useState<BillingCustomer | null>(null);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);
    const [isPending, startTransition] = useTransition();

    // Fetch Initial Data
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

    // Handle Quantity Update
    const onUpdateQuantity = async (customer: BillingCustomer, newQty: number) => {
        if (newQty < 1) return;

        // Optimistic Update
        setCustomers(prev => prev.map(c =>
            c.id === customer.id ? { ...c, plan_quantity: newQty } : c
        ));

        try {
            const res = await updateSubscriptionQuantity(customer.id, newQty);
            if (!res.success) {
                throw new Error(res.error);
            }
        } catch (err) {
            // Revert on error
            setCustomers(prev => prev.map(c =>
                c.id === customer.id ? { ...c, plan_quantity: customer.plan_quantity } : c
            ));
            alert('Failed to update subscription');
        }
    };

    // Load Invoices when opening drawer
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
        else alert('Could not generate portal link');
    };

    // Use the hook instead of the prop
    const searchParamsHook = useSearchParams();

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes((searchParamsHook.get('q') || '').toLowerCase())
    );

    return (
        <div className="p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <CreditCard className="w-8 h-8 text-primary-500" />
                        Billing & Subscriptions
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">
                        Manage all restaurant subscriptions and invoices in one place.
                    </p>
                </div>

                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                        placeholder="Search restaurants..."
                        className="pl-10 h-12 rounded-xl bg-white border-slate-200 shadow-sm"
                    // In a real implementation, use router.push/replace for searchParams
                    />
                </div>
            </div>

            {/* Metrics Cards (Optional Placeholder) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                    title="Total MRR"
                    value={formatPrice(customers.reduce((acc, c) => acc + (c.mrr || 0), 0), 'en-US')}
                    icon={<CreditCard className="w-5 h-5 text-green-500" />}
                    trend="+12% from last month"
                />
                <MetricCard
                    title="Active Subscriptions"
                    value={customers.filter(c => c.subscription_status === 'active').length.toString()}
                    icon={<CheckCircle className="w-5 h-5 text-blue-500" />}
                    trend="All systems operational"
                />
                <MetricCard
                    title="Past Due"
                    value={customers.filter(c => c.subscription_status === 'past_due').length.toString()}
                    icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
                    trend="Requires attention"
                />
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50/50">
                        <TableRow className="hover:bg-transparent border-slate-100">
                            <TableHead className="w-[300px] font-bold text-slate-900">Restaurant</TableHead>
                            <TableHead className="font-bold text-slate-900">Status</TableHead>
                            <TableHead className="font-bold text-slate-900">Monthly Revenue</TableHead>
                            <TableHead className="font-bold text-slate-900 text-center">Kiosks (Qty)</TableHead>
                            <TableHead className="font-bold text-slate-900 text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i} className="animate-pulse">
                                    <TableCell><div className="h-6 w-48 bg-slate-100 rounded"></div></TableCell>
                                    <TableCell><div className="h-6 w-24 bg-slate-100 rounded"></div></TableCell>
                                    <TableCell><div className="h-6 w-20 bg-slate-100 rounded"></div></TableCell>
                                    <TableCell><div className="h-8 w-24 bg-slate-100 rounded mx-auto"></div></TableCell>
                                    <TableCell><div className="h-8 w-8 bg-slate-100 rounded ml-auto"></div></TableCell>
                                </TableRow>
                            ))
                        ) : (
                            filteredCustomers.map((customer) => (
                                <TableRow key={customer.id} className="group hover:bg-slate-50/50 transition-colors border-slate-50">
                                    <TableCell className="font-bold text-slate-700">
                                        <div className="flex flex-col">
                                            <span className="text-base">{customer.name}</span>
                                            <span className="text-xs text-slate-400 font-medium">{customer.email || 'No email'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={customer.subscription_status === 'active' ? 'default' : 'destructive'}
                                            className="uppercase tracking-wider font-bold text-[10px]"
                                        >
                                            {customer.subscription_status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono font-bold text-slate-600">
                                        {formatPrice(customer.mrr || 0, 'en-US')}
                                        <span className="text-xs text-slate-400 font-medium ml-1">/mo</span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => onUpdateQuantity(customer, (customer.plan_quantity || 0) - 1)}
                                                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center active:scale-95 transition-all disabled:opacity-50"
                                                disabled={customer.plan_quantity <= 1}
                                            >
                                                -
                                            </button>
                                            <span className="w-8 text-center font-bold text-lg tabular-nums">{customer.plan_quantity}</span>
                                            <button
                                                onClick={() => onUpdateQuantity(customer, (customer.plan_quantity || 0) + 1)}
                                                className="w-8 h-8 rounded-lg bg-primary-100 hover:bg-primary-200 text-primary-700 flex items-center justify-center active:scale-95 transition-all"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openDetails(customer)}
                                            className="hover:bg-slate-200 rounded-full"
                                        >
                                            <MoreHorizontal className="w-5 h-5 text-slate-500" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Invoices Dialog */}
            <Dialog open={!!selectedCustomer} onOpenChange={(val) => !val && setSelectedCustomer(null)}>
                <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black">{selectedCustomer?.name}</DialogTitle>
                        <div className="flex gap-2 mt-2">
                            <Button onClick={handleOpenPortal} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200">
                                <ExternalLink className="w-4 h-4" />
                                Open Stripe Portal
                            </Button>
                        </div>
                    </DialogHeader>

                    <div className="space-y-8 mt-4">
                        <div>
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-slate-400" />
                                Invoice History
                            </h3>
                            <div className="space-y-3">
                                {loadingInvoices ? (
                                    <div className="p-4 text-center text-slate-400">Loading invoices...</div>
                                ) : invoices.length === 0 ? (
                                    <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                                        No invoices found
                                    </div>
                                ) : (
                                    invoices.map((inv) => (
                                        <div key={inv.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-300 transition-colors group">
                                            <div>
                                                <p className="font-bold text-slate-700">{inv.amount} {inv.currency}</p>
                                                <p className="text-xs text-slate-400 font-medium">{inv.date} • {inv.number}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Badge variant={inv.status === 'paid' ? 'outline' : 'destructive'} className="uppercase text-[10px]">
                                                    {inv.status}
                                                </Badge>
                                                {inv.pdf_url && (
                                                    <a
                                                        href={inv.pdf_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 bg-white rounded-lg shadow-sm text-slate-400 hover:text-primary-600 transition-colors"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function MetricCard({ title, value, icon, trend }: any) {
    return (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/30 flex flex-col gap-2">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{title}</span>
                <div className="p-2 bg-slate-50 rounded-xl">{icon}</div>
            </div>
            <span className="text-3xl font-black text-slate-900 tracking-tight">{value}</span>
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                {trend}
            </span>
        </div>
    );
}

// Helper icon
function AlertTriangle({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
        </svg>
    )
}
