'use client';

import { useState, useTransition, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    Search, Users, MoreHorizontal, Download, ExternalLink,
    CreditCard, Calendar, CheckCircle, AlertTriangle, ChevronDown,
    Mail, Send, Loader2, Copy, Plus, Edit3, Trash2, Layers,
    Tv, Utensils, Smartphone, Sparkles, ShieldCheck, Check, DollarSign,
    QrCode, RefreshCw
} from 'lucide-react';
import {
    getAllCustomersBilling,
    getBillingAndPlansBundle,
    updateSubscriptionQuantity,
    getCustomerInvoices,
    generatePortalLink,
    sendInvoiceEmail,
    updateSubscriptionPrice,
    updateSubscriptionBillingDate,
    updateCustomerEmail,
    logClientError,
    BillingCustomer
} from '@/actions/stripe-admin';
import {
    getSubscriptionPlans,
    saveSubscriptionPlan,
    deleteSubscriptionPlan,
    assignPlanToRestaurant
} from '@/actions/plans-admin';
import {
    SubscriptionPlan,
    DEFAULT_SUBSCRIPTION_PLANS
} from '@/lib/subscription-plans';
import { formatPrice, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';

export default function SuperAdminBillingPage() {
    // Pestaña activa: 'plans' (Planes del SaaS) o 'customers' (Facturación de Restaurantes)
    const [activeTab, setActiveTab] = useState<'plans' | 'customers'>('plans');

    // Estado de Clientes / Restaurantes
    const [customers, setCustomers] = useState<BillingCustomer[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCustomer, setSelectedCustomer] = useState<BillingCustomer | null>(null);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);

    const [customPrice, setCustomPrice] = useState<string>('');
    const [customDate, setCustomDate] = useState<string>('');
    const [customEmail, setCustomEmail] = useState<string>('');
    const [customQuantity, setCustomQuantity] = useState<string>('');
    const [updatingPrice, setUpdatingPrice] = useState(false);
    const [updatingDate, setUpdatingDate] = useState(false);
    const [updatingEmail, setUpdatingEmail] = useState(false);
    const [updatingQuantity, setUpdatingQuantity] = useState(false);

    // Estado de Planes de Pago (Subscription Plans)
    const [plans, setPlans] = useState<SubscriptionPlan[]>(DEFAULT_SUBSCRIPTION_PLANS);
    const [loadingPlans, setLoadingPlans] = useState(false);
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
    const [savingPlan, setSavingPlan] = useState(false);
    const [syncStripeOption, setSyncStripeOption] = useState(false);

    // Modal de asignación de plan a restaurante
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [planToAssign, setPlanToAssign] = useState<SubscriptionPlan | null>(null);
    const [targetRestaurantId, setTargetRestaurantId] = useState<string>('');
    const [assigningPlan, setAssigningPlan] = useState(false);

    // Campos del formulario de plan
    const [formName, setFormName] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formCategory, setFormCategory] = useState<SubscriptionPlan['category']>('salon');
    const [formMonthlyPrice, setFormMonthlyPrice] = useState('99');
    const [formSetupFee, setFormSetupFee] = useState('450');
    const [formMaxScreens, setFormMaxScreens] = useState('0');
    const [formExtraScreenPrice, setFormExtraScreenPrice] = useState('10.99');
    const [formModKiosk, setFormModKiosk] = useState(false);
    const [formModKds, setFormModKds] = useState(true);
    const [formModWaitress, setFormModWaitress] = useState(true);
    const [formModQr, setFormModQr] = useState(true);
    const [formFeaturesText, setFormFeaturesText] = useState('');
    const [formIsActive, setFormIsActive] = useState(true);
    const [formIsPopular, setFormIsPopular] = useState(false);

    const loadBillingData = async () => {
        setLoading(true);
        try {
            const data = await getAllCustomersBilling();
            setCustomers(data);
        } catch (err) {
            console.error('Error loading billing data', err);
        } finally {
            setLoading(false);
        }
    };

    const loadPlansData = async () => {
        setLoadingPlans(true);
        try {
            const data = await getSubscriptionPlans();
            setPlans(data);
        } catch (err) {
            console.error('Error loading plans:', err);
        } finally {
            setLoadingPlans(false);
        }
    };

    useEffect(() => {
        let mounted = true;
        const loadInitialBundle = async () => {
            setLoading(true);
            try {
                const { customers: custData, plans: plansData } = await getBillingAndPlansBundle();
                if (!mounted) return;
                setCustomers(custData);
                if (plansData && plansData.length > 0) {
                    setPlans(plansData);
                }
            } catch (err) {
                console.error('Error loading billing bundle:', err);
            } finally {
                if (mounted) {
                    setLoading(false);
                    setLoadingPlans(false);
                }
            }
        };
        loadInitialBundle();
        return () => { mounted = false; };
    }, []);

    const openCreatePlanModal = () => {
        setEditingPlan(null);
        setFormName('');
        setFormDescription('');
        setFormCategory('salon');
        setFormMonthlyPrice('99');
        setFormSetupFee('450');
        setFormMaxScreens('0');
        setFormExtraScreenPrice('10.99');
        setFormModKiosk(false);
        setFormModKds(true);
        setFormModWaitress(true);
        setFormModQr(true);
        setFormFeaturesText('Comandeo móvil para meseros (BYOD)\nPantalla de Cocina (KDS) en tiempo real\nDigitalización completa del menú');
        setFormIsActive(true);
        setFormIsPopular(false);
        setSyncStripeOption(false);
        setIsPlanModalOpen(true);
    };

    const openEditPlanModal = (plan: SubscriptionPlan) => {
        setEditingPlan(plan);
        setFormName(plan.name);
        setFormDescription(plan.description);
        setFormCategory(plan.category);
        setFormMonthlyPrice(plan.monthly_price.toString());
        setFormSetupFee(plan.setup_fee.toString());
        setFormMaxScreens(plan.max_screens.toString());
        setFormExtraScreenPrice(plan.extra_screen_price?.toString() || '10.99');
        setFormModKiosk(plan.modules.kiosk);
        setFormModKds(plan.modules.kds);
        setFormModWaitress(plan.modules.waitress_exo);
        setFormModQr(plan.modules.qr_menu);
        setFormFeaturesText((plan.features || []).join('\n'));
        setFormIsActive(plan.is_active);
        setFormIsPopular(plan.is_popular || false);
        setSyncStripeOption(false);
        setIsPlanModalOpen(true);
    };

    const handleSavePlanSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formName.trim()) {
            alert('Por favor ingresa un nombre para el plan.');
            return;
        }

        const monthlyPriceNum = parseFloat(formMonthlyPrice);
        if (isNaN(monthlyPriceNum) || monthlyPriceNum < 0) {
            alert('El precio mensual debe ser un número válido mayor o igual a 0.');
            return;
        }

        const setupFeeNum = parseFloat(formSetupFee) || 0;
        const maxScreensNum = parseInt(formMaxScreens) || 0;
        const extraScreenPriceNum = parseFloat(formExtraScreenPrice) || 10.99;

        const featuresArray = formFeaturesText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        const planId = editingPlan ? editingPlan.id : `plan_${formName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString().slice(-4)}`;

        const planData: SubscriptionPlan = {
            id: planId,
            name: formName.trim(),
            description: formDescription.trim(),
            monthly_price: monthlyPriceNum,
            setup_fee: setupFeeNum,
            annual_price: Math.round(monthlyPriceNum * 10), // 2 meses gratis por año
            stripe_product_id: editingPlan?.stripe_product_id,
            stripe_price_id: editingPlan?.stripe_price_id,
            modules: {
                kiosk: formModKiosk,
                kds: formModKds,
                waitress_exo: formModWaitress,
                qr_menu: formModQr,
            },
            max_screens: maxScreensNum,
            extra_screen_price: extraScreenPriceNum,
            features: featuresArray,
            is_active: formIsActive,
            is_popular: formIsPopular,
            category: formCategory,
            created_at: editingPlan?.created_at,
        };

        setSavingPlan(true);
        try {
            const res = await saveSubscriptionPlan(planData, syncStripeOption);
            if (res.success) {
                alert(editingPlan ? 'Plan actualizado exitosamente.' : 'Nuevo plan de pago creado exitosamente.');
                setIsPlanModalOpen(false);
                await loadPlansData();
            } else {
                alert('Error al guardar el plan: ' + res.error);
            }
        } catch (err: any) {
            console.error('Error saving plan:', err);
            alert('Ocurrió un error inesperado al guardar el plan.');
        } finally {
            setSavingPlan(false);
        }
    };

    const handleDeletePlanClick = async (plan: SubscriptionPlan) => {
        if (!confirm(`¿Estás seguro de que deseas eliminar el plan "${plan.name}"?`)) {
            return;
        }
        try {
            const res = await deleteSubscriptionPlan(plan.id);
            if (res.success) {
                alert('Plan eliminado correctamente.');
                await loadPlansData();
            } else {
                alert('Error al eliminar: ' + res.error);
            }
        } catch (err) {
            console.error(err);
            alert('Error al eliminar el plan');
        }
    };

    const openAssignModal = (plan: SubscriptionPlan) => {
        setPlanToAssign(plan);
        if (customers.length > 0) {
            setTargetRestaurantId(customers[0].id);
        }
        setAssignModalOpen(true);
    };

    const handleAssignPlanSubmit = async () => {
        if (!planToAssign || !targetRestaurantId) return;
        setAssigningPlan(true);
        try {
            const res = await assignPlanToRestaurant(targetRestaurantId, planToAssign.id);
            if (res.success) {
                alert(`Plan "${res.planName}" asignado exitosamente al restaurante.`);
                setAssignModalOpen(false);
                await loadBillingData();
            } else {
                alert('Error al asignar el plan: ' + res.error);
            }
        } catch (err: any) {
            console.error(err);
            alert('Error al asignar el plan.');
        } finally {
            setAssigningPlan(false);
        }
    };

    const handleSendInvoice = async (customerId: string) => {
        setSendingInvoiceId(customerId);
        try {
            const res = await sendInvoiceEmail(customerId);
            if (res.success) {
                alert('La factura y el enlace de pago de Stripe se enviaron exitosamente por correo electrónico al cliente.');
            } else {
                alert('Error al enviar la factura: ' + res.error);
            }
        } catch (err) {
            console.error(err);
            alert('Ocurrió un error inesperado al enviar la factura.');
        } finally {
            setSendingInvoiceId(null);
        }
    };

    const handleUpdatePrice = async () => {
        if (!selectedCustomer) return;
        const newPrice = parseFloat(customPrice);
        if (isNaN(newPrice) || newPrice <= 0) {
            alert('Por favor, ingresa un precio válido mayor a 0.');
            return;
        }
        setUpdatingPrice(true);
        try {
            const result = await updateSubscriptionPrice(selectedCustomer.id, newPrice);
            if (result.success) {
                alert('El costo de la suscripción ha sido actualizado exitosamente.');
                const updatedCustomers = await getAllCustomersBilling();
                setCustomers(updatedCustomers);
                const updatedCust = updatedCustomers.find(c => c.id === selectedCustomer.id);
                if (updatedCust) setSelectedCustomer(updatedCust);
            } else {
                alert('Error al actualizar el precio: ' + result.error);
            }
        } catch (err) {
            console.error(err);
            alert('Ocurrió un error inesperado al actualizar el precio.');
        } finally {
            setUpdatingPrice(false);
        }
    };

    const handleUpdateBillingDate = async () => {
        if (!selectedCustomer || !customDate) return;
        setUpdatingDate(true);
        try {
            const result = await updateSubscriptionBillingDate(selectedCustomer.id, customDate);
            if (result.success) {
                alert('La fecha de facturación ha sido actualizada exitosamente.');
                const updatedCustomers = await getAllCustomersBilling();
                setCustomers(updatedCustomers);
                const updatedCust = updatedCustomers.find(c => c.id === selectedCustomer.id);
                if (updatedCust) setSelectedCustomer(updatedCust);
            } else {
                alert('Error al actualizar la fecha: ' + result.error);
            }
        } catch (err) {
            console.error(err);
            alert('Ocurrió un error inesperado al actualizar la fecha.');
        } finally {
            setUpdatingDate(false);
        }
    };

    const handleUpdateEmail = async () => {
        if (!selectedCustomer) return;
        if (!customEmail || !customEmail.includes('@')) {
            alert('Por favor, ingresa un correo electrónico válido.');
            return;
        }
        setUpdatingEmail(true);
        try {
            const result = await updateCustomerEmail(selectedCustomer.id, customEmail);
            if (result.success) {
                alert('El correo electrónico de cobro ha sido actualizado exitosamente.');
                const updatedCustomers = await getAllCustomersBilling();
                setCustomers(updatedCustomers);
                const updatedCust = updatedCustomers.find(c => c.id === selectedCustomer.id);
                if (updatedCust) setSelectedCustomer(updatedCust);
            } else {
                alert('Error al actualizar el correo: ' + result.error);
            }
        } catch (err) {
            console.error(err);
            alert('Ocurrió un error inesperado al actualizar el correo.');
        } finally {
            setUpdatingEmail(false);
        }
    };

    const handleUpdateQuantity = async () => {
        if (!selectedCustomer) return;
        const newQty = parseInt(customQuantity);
        if (isNaN(newQty) || newQty < 1) {
            alert('Por favor, ingresa una cantidad de quioscos válida mayor o igual a 1.');
            return;
        }
        setUpdatingQuantity(true);
        try {
            const result = await updateSubscriptionQuantity(selectedCustomer.id, newQty);
            if (result.success) {
                alert('La cantidad de licencias/quioscos ha sido actualizada exitosamente.');
                const updatedCustomers = await getAllCustomersBilling();
                setCustomers(updatedCustomers);
                const updatedCust = updatedCustomers.find(c => c.id === selectedCustomer.id);
                if (updatedCust) setSelectedCustomer(updatedCust);
            } else {
                alert('Error al actualizar la cantidad: ' + result.error);
            }
        } catch (err) {
            console.error(err);
            alert('Ocurrió un error inesperado al actualizar la cantidad.');
        } finally {
            setUpdatingQuantity(false);
        }
    };


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
        try {
            setSelectedCustomer(customer);
            setCustomPrice(customer.unit_price?.toString() || '49');
            
            let initialDate = '';
            if (customer.next_billing_date) {
                try {
                    const dateObj = new Date(customer.next_billing_date);
                    if (!isNaN(dateObj.getTime())) {
                        initialDate = dateObj.toISOString().split('T')[0];
                    }
                } catch (e) {
                    console.error('Invalid billing date format:', e);
                }
            }
            setCustomDate(initialDate);
            
            setCustomEmail(customer.email || '');
            setCustomQuantity(customer.plan_quantity?.toString() || '1');
            setLoadingInvoices(true);
            try {
                if (customer.stripe_customer_id) {
                    const data = await getCustomerInvoices(customer.id);
                    setInvoices(data);
                } else {
                    setInvoices([]);
                }
            } catch (invErr) {
                console.error('Error fetching customer invoices:', invErr);
                setInvoices([]);
            }
            setLoadingInvoices(false);
        } catch (err: any) {
            console.error('Global openDetails error:', err);
            await logClientError(err?.message || 'Unknown openDetails error', err?.stack);
            alert('Error al gestionar: ' + (err?.message || err));
        }
    };

    const handleOpenPortal = async () => {
        if (!selectedCustomer?.stripe_customer_id) return;
        const url = await generatePortalLink(selectedCustomer.id);
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
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-8 h-1 bg-emerald-500 rounded-full"></span>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Gestión Financiera Central</span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        {activeTab === 'plans' ? 'Planes de Pago SaaS' : 'Facturación de Restaurantes'}
                    </h1>
                </div>

                {/* Tabs Switcher */}
                <div className="flex flex-wrap items-center gap-2 bg-slate-900/80 p-2 rounded-[2rem] border border-slate-800 shadow-xl">
                    <button
                        type="button"
                        onClick={() => setActiveTab('plans')}
                        className={cn(
                            "px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2.5 transition-all",
                            activeTab === 'plans'
                                ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
                                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                        )}
                    >
                        <Layers className="w-4 h-4" />
                        <span>Planes de Pago</span>
                        <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-black",
                            activeTab === 'plans' ? "bg-slate-950/20 text-slate-950" : "bg-slate-800 text-slate-400"
                        )}>
                            {plans.length}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('customers')}
                        className={cn(
                            "px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2.5 transition-all",
                            activeTab === 'customers'
                                ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
                                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                        )}
                    >
                        <Users className="w-4 h-4" />
                        <span>Facturación & Clientes</span>
                        <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-black",
                            activeTab === 'customers' ? "bg-slate-950/20 text-slate-950" : "bg-slate-800 text-slate-400"
                        )}>
                            {customers.length}
                        </span>
                    </button>
                </div>

                {activeTab === 'customers' ? (
                    <div className="relative group w-full lg:w-80">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="BUSCAR RESTAURANTE..."
                            className="w-full pl-16 pr-8 py-4 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-[2rem] focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-white text-xs uppercase tracking-widest shadow-inner placeholder:text-slate-700"
                        />
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={loadPlansData}
                            disabled={loadingPlans}
                            className="p-4 bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-2xl transition-all active:scale-95 shadow-lg"
                            title="Recargar planes"
                        >
                            <RefreshCw className={cn("w-4 h-4", loadingPlans && "animate-spin")} />
                        </button>
                        <button
                            type="button"
                            onClick={openCreatePlanModal}
                            className="px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center gap-2 text-xs uppercase tracking-widest active:scale-95 transition-all"
                        >
                            <Plus className="w-4 h-4 stroke-[3]" />
                            <span>Nuevo Plan de Pago</span>
                        </button>
                    </div>
                )}
            </div>

            {/* TAB 1: PLANES DE PAGO SAAS */}
            {activeTab === 'plans' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    {/* Commercial Banner Info */}
                    <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-900 p-8 rounded-[3rem] border border-slate-800 relative overflow-hidden shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-2 max-w-2xl">
                            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                                <Sparkles className="w-4 h-4" />
                                Estructura de Precios Oficial (Florida Market)
                            </span>
                            <h2 className="text-2xl font-black text-white italic tracking-tight uppercase">
                                Suscripciones Base $99/mes + Hardware / Setup
                            </h2>
                            <p className="text-xs text-slate-400 font-medium leading-relaxed">
                                Planes comerciales listos para asignar a clientes o sincronizar con Stripe. Cada pantalla adicional fuera del paquete base añade <strong className="text-emerald-400 font-black">$10.99/mes</strong> a la factura mensual del restaurante.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <span className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl font-black text-[10px] uppercase tracking-wider">
                                {plans.filter(p => p.is_active).length} Planes Activos
                            </span>
                        </div>
                    </div>

                    {/* Plans Grid */}
                    {loadingPlans ? (
                        <div className="p-32 text-center bg-slate-900/20 rounded-[3rem] border border-slate-800">
                            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Cargando catálogo de planes...</p>
                        </div>
                    ) : plans.length === 0 ? (
                        <div className="p-32 text-center bg-slate-900/20 rounded-[3rem] border border-dashed border-slate-800">
                            <Layers className="w-16 h-16 text-slate-800 mx-auto mb-6" />
                            <h2 className="text-2xl font-black text-slate-700 uppercase italic tracking-tighter">Sin Planes Registrados</h2>
                            <button
                                onClick={openCreatePlanModal}
                                className="mt-4 px-6 py-3 bg-emerald-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider"
                            >
                                Crear Primer Plan
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                            {plans.map(plan => {
                                const isSalon = plan.category === 'salon';
                                const isKiosk = plan.category === 'kiosk';
                                const isByod = plan.category === 'byod';
                                const isAddon = plan.category === 'addon';

                                return (
                                    <div
                                        key={plan.id}
                                        className={cn(
                                            "bg-slate-900/50 backdrop-blur-md p-8 rounded-[3rem] border transition-all duration-300 relative group flex flex-col justify-between overflow-hidden shadow-2xl",
                                            plan.is_popular
                                                ? "border-orange-500/60 shadow-orange-500/10 ring-1 ring-orange-500/30"
                                                : "border-slate-800 hover:border-slate-700"
                                        )}
                                    >
                                        {/* Top Glow */}
                                        <div className={cn(
                                            "absolute -right-12 -top-12 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none transition-all",
                                            plan.is_popular ? "bg-orange-500" : isSalon ? "bg-amber-500" : isKiosk ? "bg-sky-500" : "bg-emerald-500"
                                        )} />

                                        <div>
                                            {/* Badges Bar */}
                                            <div className="flex items-center justify-between gap-3 mb-6">
                                                <div className="flex items-center gap-2">
                                                    <span className={cn(
                                                        "px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider border flex items-center gap-1.5",
                                                        isSalon && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                                                        isKiosk && "bg-sky-500/10 text-sky-400 border-sky-500/20",
                                                        isByod && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                                                        isAddon && "bg-purple-500/10 text-purple-400 border-purple-500/20",
                                                        !isSalon && !isKiosk && !isByod && !isAddon && "bg-slate-500/10 text-slate-400 border-slate-500/20"
                                                    )}>
                                                        {isSalon && <Utensils className="w-3 h-3" />}
                                                        {isKiosk && <Tv className="w-3 h-3" />}
                                                        {isByod && <Smartphone className="w-3 h-3" />}
                                                        {isAddon && <Tv className="w-3 h-3" />}
                                                        {plan.category === 'salon' ? 'Salón & Meseros' : plan.category === 'kiosk' ? 'Kiosko Autoservicio' : plan.category === 'byod' ? 'BYOD Meseros' : plan.category === 'addon' ? 'Pantalla Extra' : 'Personalizado'}
                                                    </span>

                                                    <span className={cn(
                                                        "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                                                        plan.is_active ? "text-emerald-400 bg-emerald-500/10" : "text-slate-500 bg-slate-800"
                                                    )}>
                                                        {plan.is_active ? 'Activo' : 'Inactivo'}
                                                    </span>
                                                </div>

                                                {plan.is_popular && (
                                                    <span className="px-3 py-1 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 rounded-full font-black text-[9px] uppercase tracking-widest shadow-md">
                                                        ★ Popular
                                                    </span>
                                                )}
                                            </div>

                                            {/* Name & Description */}
                                            <h3 className="text-2xl font-black text-white italic tracking-tight uppercase leading-tight">
                                                {plan.name}
                                            </h3>
                                            <p className="text-xs text-slate-400 font-medium mt-2 line-clamp-2 leading-relaxed">
                                                {plan.description || 'Sin descripción comercial.'}
                                            </p>

                                            {/* Pricing Box */}
                                            <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 my-6 space-y-2">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-4xl font-black text-white italic tracking-tighter">
                                                        {formatPrice(plan.monthly_price, 'en-US')}
                                                    </span>
                                                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                                                        / mes
                                                    </span>
                                                </div>

                                                <div className="flex flex-wrap items-center justify-between text-[10px] font-bold gap-2 pt-2 border-t border-slate-800">
                                                    <span className="text-amber-400 uppercase tracking-wider">
                                                        Setup: {plan.setup_fee > 0 ? formatPrice(plan.setup_fee, 'en-US') : 'Incluido'}
                                                    </span>
                                                    <span className="text-slate-400 uppercase tracking-wider">
                                                        {plan.max_screens === 0 ? 'Pantallas ilimitadas' : `${plan.max_screens} pantalla base`}
                                                    </span>
                                                </div>
                                                {plan.extra_screen_price && plan.extra_screen_price > 0 && (
                                                    <p className="text-[9px] text-slate-500 font-medium">
                                                        +${plan.extra_screen_price}/mes c/pantalla adicional
                                                    </p>
                                                )}
                                            </div>

                                            {/* Modules Badges */}
                                            <div className="space-y-2 mb-6">
                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">
                                                    Módulos Habilitados:
                                                </span>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {plan.modules.waitress_exo && (
                                                        <span className="px-2.5 py-1 bg-slate-950 rounded-lg border border-slate-800 text-[10px] font-bold text-amber-400 flex items-center gap-1.5">
                                                            <Smartphone className="w-3 h-3" /> Meseros
                                                        </span>
                                                    )}
                                                    {plan.modules.kds && (
                                                        <span className="px-2.5 py-1 bg-slate-950 rounded-lg border border-slate-800 text-[10px] font-bold text-emerald-400 flex items-center gap-1.5">
                                                            <Utensils className="w-3 h-3" /> Cocina KDS
                                                        </span>
                                                    )}
                                                    {plan.modules.kiosk && (
                                                        <span className="px-2.5 py-1 bg-slate-950 rounded-lg border border-slate-800 text-[10px] font-bold text-sky-400 flex items-center gap-1.5">
                                                            <Tv className="w-3 h-3" /> Kiosko Touch
                                                        </span>
                                                    )}
                                                    {plan.modules.qr_menu && (
                                                        <span className="px-2.5 py-1 bg-slate-950 rounded-lg border border-slate-800 text-[10px] font-bold text-teal-400 flex items-center gap-1.5">
                                                            <QrCode className="w-3 h-3" /> Menú QR
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Features List */}
                                            {plan.features && plan.features.length > 0 && (
                                                <ul className="space-y-2 mb-6 border-t border-slate-800/60 pt-4">
                                                    {plan.features.map((feat, idx) => (
                                                        <li key={idx} className="flex items-start gap-2 text-xs text-slate-300 font-medium">
                                                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                                            <span>{feat}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}

                                            {/* Stripe Badge */}
                                            <div className="pt-2 pb-4">
                                                {plan.stripe_product_id ? (
                                                    <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5">
                                                        <Check className="w-3 h-3" />
                                                        Stripe Product ID: {plan.stripe_product_id.slice(0, 14)}...
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] font-bold text-slate-500 bg-slate-800/40 px-2.5 py-1 rounded-lg inline-block">
                                                        Solo Configuración Local
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="space-y-2 pt-4 border-t border-slate-800/80">
                                            <button
                                                type="button"
                                                onClick={() => openAssignModal(plan)}
                                                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 active:scale-95"
                                            >
                                                <Users className="w-3.5 h-3.5 stroke-[2.5]" />
                                                <span>Asignar a Restaurante</span>
                                            </button>

                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => openEditPlanModal(plan)}
                                                    className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-black rounded-xl text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                                                >
                                                    <Edit3 className="w-3 h-3" />
                                                    <span>Editar</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeletePlanClick(plan)}
                                                    className="py-2.5 bg-slate-800/40 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 font-black rounded-xl text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                    <span>Eliminar</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: FACTURACIÓN Y CLIENTES */}
            {activeTab === 'customers' && (
                <div className="space-y-10 animate-in fade-in duration-300">
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
                    <table className="w-full min-w-[1200px]">
                        <thead className="bg-slate-950/20 border-b border-slate-800/50">
                            <tr>
                                <th className="px-6 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-left">Restaurante Cliente</th>
                                <th className="px-6 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-left">Suscripción ID</th>
                                <th className="px-6 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-left">Estado</th>
                                <th className="px-6 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-left">Vence el</th>
                                <th className="px-6 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-left">Costo Unit.</th>
                                <th className="px-6 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-center">Nº Quioscos</th>
                                <th className="px-6 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-left">MRR Total</th>
                                <th className="px-6 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-right">Opciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-8"><div className="h-6 w-48 bg-slate-800 rounded"></div></td>
                                        <td className="px-6 py-8"><div className="h-6 w-32 bg-slate-800 rounded"></div></td>
                                        <td className="px-6 py-8"><div className="h-6 w-24 bg-slate-800 rounded"></div></td>
                                        <td className="px-6 py-8"><div className="h-6 w-20 bg-slate-800 rounded"></div></td>
                                        <td className="px-6 py-8"><div className="h-6 w-16 bg-slate-800 rounded"></div></td>
                                        <td className="px-6 py-8"><div className="h-8 w-24 bg-slate-800 rounded mx-auto"></div></td>
                                        <td className="px-6 py-8"><div className="h-6 w-24 bg-slate-800 rounded"></div></td>
                                        <td className="px-6 py-8"><div className="h-8 w-8 bg-slate-800 rounded ml-auto"></div></td>
                                    </tr>
                                ))
                            ) : (
                                filteredCustomers.map((customer) => (
                                    <tr key={customer.id} className="group hover:bg-slate-800/20 transition-all duration-300">
                                        <td className="px-6 py-8">
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
                                        <td className="px-6 py-8">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs text-slate-400">
                                                    {customer.stripe_subscription_id ? `${customer.stripe_subscription_id.substring(0, 12)}...` : 'Sin Suscripción'}
                                                </span>
                                                {customer.stripe_subscription_id && (
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(customer.stripe_subscription_id || '');
                                                            alert('ID de suscripción copiado.');
                                                        }}
                                                        className="text-slate-600 hover:text-emerald-500 transition-colors"
                                                        title="Copiar ID de Suscripción"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-8">
                                            <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-lg ${customer.subscription_status === 'active'
                                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                    : customer.subscription_status === 'past_due'
                                                        ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                                }`}>
                                                {customer.subscription_status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-8">
                                            <span className="font-black text-slate-300 text-xs uppercase tracking-widest">
                                                {customer.next_billing_date ? new Date(customer.next_billing_date).toLocaleDateString() : '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-8">
                                            <span className="font-black text-white text-lg italic tracking-tighter">
                                                {formatPrice(customer.unit_price || 49, 'en-US')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-8">
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
                                        <td className="px-6 py-8">
                                            <span className="flex items-end gap-1 font-black text-white text-2xl italic tracking-tighter uppercase">
                                                {formatPrice(customer.mrr || 0, 'en-US')}
                                                <span className="text-[10px] text-slate-600 uppercase tracking-widest leading-6">/MES</span>
                                            </span>
                                        </td>
                                        <td className="px-6 py-8 text-right">
                                            <button
                                                onClick={() => openDetails(customer)}
                                                className="p-5 bg-slate-800 hover:bg-emerald-500 text-slate-400 hover:text-slate-900 rounded-2xl transition-all shadow-xl hover:scale-105 ml-auto flex items-center gap-2"
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

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-6">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-slate-900/40 backdrop-blur-sm p-8 rounded-[3rem] border border-slate-800 animate-pulse space-y-6">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 bg-slate-800 rounded-[1.25rem]"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-5 bg-slate-800 rounded w-2/3"></div>
                                    <div className="h-3 bg-slate-800 rounded w-1/2"></div>
                                </div>
                            </div>
                            <div className="h-10 bg-slate-800 rounded-2xl"></div>
                        </div>
                    ))
                ) : (
                    filteredCustomers.map((customer) => (
                        <div key={customer.id} className="bg-slate-900/50 backdrop-blur-md p-8 rounded-[3rem] border border-slate-800 relative group overflow-hidden animate-in fade-in duration-300">
                            <div className="flex items-center justify-between gap-4 mb-6">
                                <div className="flex items-center gap-5">
                                    <div className="w-14 h-14 rounded-[1.25rem] bg-slate-950 flex items-center justify-center border border-slate-800 shadow-xl overflow-hidden flex-shrink-0">
                                        <span className="font-black text-slate-700 text-lg uppercase">{customer.name.substring(0, 1)}</span>
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-black text-white text-xl italic tracking-tighter uppercase leading-tight truncate">
                                            {customer.name}
                                        </h3>
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest truncate mt-0.5">
                                            {customer.email || 'SIN CORREO'}
                                        </p>
                                    </div>
                                </div>
                                <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider shrink-0 border ${customer.subscription_status === 'active'
                                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                        : customer.subscription_status === 'past_due'
                                            ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                                            : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                    }`}>
                                    {customer.subscription_status}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Costo Unitario</p>
                                    <p className="text-sm font-black text-white">{formatPrice(customer.unit_price || 49, 'en-US')}</p>
                                </div>
                                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">MRR Total</p>
                                    <p className="text-sm font-black text-emerald-500">{formatPrice(customer.mrr || 0, 'en-US')}</p>
                                </div>
                                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Nº Quioscos</p>
                                    <p className="text-sm font-black text-white">{customer.plan_quantity} dispositivo(s)</p>
                                </div>
                                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Próx. Vencimiento</p>
                                    <p className="text-xs font-black text-slate-300 truncate">{customer.next_billing_date ? new Date(customer.next_billing_date).toLocaleDateString() : '—'}</p>
                                </div>
                            </div>

                            <button
                                onClick={() => openDetails(customer)}
                                className="w-full py-5 bg-slate-800 hover:bg-emerald-500 text-slate-400 hover:text-slate-900 rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg border border-slate-700 hover:border-emerald-500"
                            >
                                <MoreHorizontal className="w-5 h-5" />
                                <span>Gestionar Suscripción</span>
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Empty UI Check */}
            {filteredCustomers.length === 0 && !loading && (
                <div className="p-32 text-center bg-slate-900/20 rounded-[3rem] border border-dashed border-slate-800">
                    <CreditCard className="w-16 h-16 text-slate-800 mx-auto mb-6" />
                    <h2 className="text-2xl font-black text-slate-700 uppercase italic tracking-tighter">Sin Suscripciones Encontradas</h2>
                </div>
            )}
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
                            {/* Manual Invoicing Section */}
                            <div className="mb-10 p-8 rounded-[2rem] bg-slate-950/60 border border-slate-800 relative overflow-hidden group">
                                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-emerald-500/10 blur-2xl"></div>
                                
                                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="space-y-1">
                                        <h4 className="text-lg font-black text-white italic tracking-tighter uppercase flex items-center gap-2 leading-none">
                                            <Mail className="w-5 h-5 text-emerald-500" />
                                            Enviar Factura de Pago
                                        </h4>
                                        <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px] mt-1">Cobros automáticos recurrentes por correo</p>
                                        <p className="text-slate-400 text-xs font-medium leading-relaxed max-w-lg mt-3">
                                            Crea una factura mensual en Stripe calculada según el número de quioscos actual ({selectedCustomer.plan_quantity} licencia(s) = {formatPrice((selectedCustomer.mrr || 49), 'en-US')}/mes) y la envía directamente al correo <span className="text-emerald-500 font-bold">{selectedCustomer.email || 'propietario'}</span> con el enlace del formulario de pagos de Stripe.
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => handleSendInvoice(selectedCustomer.id)}
                                        disabled={sendingInvoiceId !== null}
                                        className="px-8 py-5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-slate-900 rounded-2xl font-black uppercase tracking-widest border border-emerald-500/20 hover:border-emerald-500 transition-all active:scale-95 text-[10px] flex items-center justify-center gap-3 disabled:opacity-50 shrink-0 self-start md:self-center shadow-lg"
                                    >
                                        {sendingInvoiceId === selectedCustomer.id ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>Enviando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4" />
                                                <span>Enviar Factura</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                            {/* Advanced Subscription Controls */}
                            <div className="mb-10 p-8 rounded-[2rem] bg-slate-950/60 border border-slate-800 relative overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                                <h4 className="text-xs font-black text-white uppercase tracking-widest mb-6 px-1">
                                    Configuración Avanzada de Suscripción
                                </h4>

                                <div className="grid grid-cols-1 gap-8">
                                    {/* Edit Email Form */}
                                    <div className="space-y-4">
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                                            Correo de Cobro (Stripe & Auth Owner)
                                        </label>
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <input
                                                type="email"
                                                value={customEmail}
                                                onChange={(e) => setCustomEmail(e.target.value)}
                                                placeholder="correo@ejemplo.com"
                                                className="flex-1 px-6 py-4 bg-slate-900 border border-slate-800 rounded-2xl focus:border-emerald-500 outline-none transition-all font-sans font-bold text-white text-sm"
                                            />
                                            <button
                                                onClick={handleUpdateEmail}
                                                disabled={updatingEmail}
                                                className="w-full sm:w-auto px-6 bg-emerald-500 hover:bg-emerald-600 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center sm:min-w-[120px]"
                                            >
                                                {updatingEmail ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    'Guardar Correo'
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Edit Quantity Form */}
                                    <div className="space-y-4">
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                                            Cantidad de Quioscos (Licencias)
                                        </label>
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <input
                                                type="number"
                                                value={customQuantity}
                                                onChange={(e) => setCustomQuantity(e.target.value)}
                                                placeholder="Cantidad..."
                                                className="flex-1 px-6 py-4 bg-slate-900 border border-slate-800 rounded-2xl focus:border-emerald-500 outline-none transition-all font-mono font-black text-white text-sm"
                                            />
                                            <button
                                                onClick={handleUpdateQuantity}
                                                disabled={updatingQuantity}
                                                className="w-full sm:w-auto px-6 bg-emerald-500 hover:bg-emerald-600 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center sm:min-w-[120px]"
                                            >
                                                {updatingQuantity ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    'Guardar Cantidad'
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Edit Billing Date Form */}
                                    <div className="space-y-4">
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                                            Próxima Fecha de Facturación
                                        </label>
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <input
                                                type="date"
                                                value={customDate}
                                                onChange={(e) => setCustomDate(e.target.value)}
                                                className="flex-1 px-6 py-4 bg-slate-900 border border-slate-800 rounded-2xl focus:border-emerald-500 outline-none transition-all font-mono font-black text-white text-sm uppercase"
                                            />
                                            <button
                                                onClick={handleUpdateBillingDate}
                                                disabled={updatingDate}
                                                className="w-full sm:w-auto px-6 bg-emerald-500 hover:bg-emerald-600 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center sm:min-w-[120px]"
                                            >
                                                {updatingDate ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    'Guardar Fecha'
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Edit Price Form */}
                                    <div className="space-y-4">
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                                            Costo Unitario por Licencia (USD)
                                        </label>
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <input
                                                type="number"
                                                value={customPrice}
                                                onChange={(e) => setCustomPrice(e.target.value)}
                                                placeholder="Precio unitario..."
                                                className="flex-1 px-6 py-4 bg-slate-900 border border-slate-800 rounded-2xl focus:border-emerald-500 outline-none transition-all font-mono font-black text-white text-sm"
                                            />
                                            <button
                                                onClick={handleUpdatePrice}
                                                disabled={updatingPrice}
                                                className="w-full sm:w-auto px-6 bg-emerald-500 hover:bg-emerald-600 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center sm:min-w-[120px]"
                                            >
                                                {updatingPrice ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    'Guardar Costo'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* IDs copy board */}
                                {(selectedCustomer.stripe_customer_id || selectedCustomer.stripe_subscription_id) && (
                                    <div className="mt-8 pt-6 border-t border-slate-800/50 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {selectedCustomer.stripe_customer_id && (
                                            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
                                                <div className="min-w-0">
                                                    <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest leading-none">Stripe Customer ID</p>
                                                    <p className="font-mono text-xs font-black text-slate-300 truncate mt-1.5">{selectedCustomer.stripe_customer_id}</p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(selectedCustomer.stripe_customer_id || '');
                                                        alert('Customer ID copiado.');
                                                    }}
                                                    className="p-2 text-slate-500 hover:text-emerald-500 hover:bg-slate-800 rounded-lg transition-all shrink-0"
                                                    title="Copiar ID de Cliente"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}

                                        {selectedCustomer.stripe_subscription_id && (
                                            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
                                                <div className="min-w-0">
                                                    <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest leading-none">Stripe Subscription ID</p>
                                                    <p className="font-mono text-xs font-black text-slate-300 truncate mt-1.5">{selectedCustomer.stripe_subscription_id}</p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(selectedCustomer.stripe_subscription_id || '');
                                                        alert('Subscription ID copiado.');
                                                    }}
                                                    className="p-2 text-slate-500 hover:text-emerald-500 hover:bg-slate-800 rounded-lg transition-all shrink-0"
                                                    title="Copiar ID de Suscripción"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

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

            {/* Modal: Crear / Editar Plan de Pago */}
            {isPlanModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-slate-800 rounded-[3rem] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-8 border-b border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="w-6 h-1 bg-emerald-500 rounded-full"></span>
                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                                        {editingPlan ? 'Editar Plan Existente' : 'Nuevo Nivel Comercial'}
                                    </span>
                                </div>
                                <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">
                                    {editingPlan ? `Editar: ${editingPlan.name}` : 'Crear Plan de Pago SaaS'}
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsPlanModalOpen(false)}
                                className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Form Body */}
                        <form onSubmit={handleSavePlanSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                                        Nombre del Plan *
                                    </label>
                                    <input
                                        type="text"
                                        value={formName}
                                        onChange={e => setFormName(e.target.value)}
                                        placeholder="ej. Exo Server Salón & Cocina"
                                        className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-3 text-white text-xs font-black uppercase tracking-wider focus:border-emerald-500 outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                                        Categoría Comercial
                                    </label>
                                    <select
                                        value={formCategory}
                                        onChange={e => setFormCategory(e.target.value as any)}
                                        className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-3 text-white text-xs font-black uppercase tracking-wider focus:border-emerald-500 outline-none"
                                    >
                                        <option value="salon">Salón & Comandas (Exo Server)</option>
                                        <option value="kiosk">Kiosko Autoservicio Touch</option>
                                        <option value="byod">BYOD (Meseros con Móvil)</option>
                                        <option value="addon">Hardware / Pantalla Adicional</option>
                                        <option value="custom">Plan Personalizado</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                                    Descripción Comercial
                                </label>
                                <input
                                    type="text"
                                    value={formDescription}
                                    onChange={e => setFormDescription(e.target.value)}
                                    placeholder="ej. Sistema integral para salón con comandeo móvil y cocina KDS"
                                    className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-3 text-white text-xs font-medium focus:border-emerald-500 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                                        Precio Mensual (USD) *
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-black text-sm">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formMonthlyPrice}
                                            onChange={e => setFormMonthlyPrice(e.target.value)}
                                            className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl pl-8 pr-4 py-3 text-white text-xs font-black tracking-wider focus:border-emerald-500 outline-none"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                                        Setup / Instalación Única (USD)
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-black text-sm">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formSetupFee}
                                            onChange={e => setFormSetupFee(e.target.value)}
                                            className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl pl-8 pr-4 py-3 text-white text-xs font-black tracking-wider focus:border-emerald-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                                        Pantallas Incluidas (0 = Ilimitadas)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formMaxScreens}
                                        onChange={e => setFormMaxScreens(e.target.value)}
                                        className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-3 text-white text-xs font-black tracking-wider focus:border-emerald-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                                        Precio por Pantalla Extra (USD/mes)
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-black text-sm">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formExtraScreenPrice}
                                            onChange={e => setFormExtraScreenPrice(e.target.value)}
                                            className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl pl-8 pr-4 py-3 text-white text-xs font-black tracking-wider focus:border-emerald-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Módulos Habilitados */}
                            <div className="bg-slate-950/50 p-5 rounded-2xl border border-slate-800">
                                <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-3">
                                    Módulos Incluidos en el Plan
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <label className="flex items-center gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800 hover:border-slate-700 cursor-pointer transition-all">
                                        <input
                                            type="checkbox"
                                            checked={formModWaitress}
                                            onChange={e => setFormModWaitress(e.target.checked)}
                                            className="w-4 h-4 rounded text-emerald-500 focus:ring-0"
                                        />
                                        <span className="text-xs font-black text-white uppercase tracking-wider">Comandeo Meseros</span>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800 hover:border-slate-700 cursor-pointer transition-all">
                                        <input
                                            type="checkbox"
                                            checked={formModKds}
                                            onChange={e => setFormModKds(e.target.checked)}
                                            className="w-4 h-4 rounded text-emerald-500 focus:ring-0"
                                        />
                                        <span className="text-xs font-black text-white uppercase tracking-wider">Cocina KDS</span>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800 hover:border-slate-700 cursor-pointer transition-all">
                                        <input
                                            type="checkbox"
                                            checked={formModKiosk}
                                            onChange={e => setFormModKiosk(e.target.checked)}
                                            className="w-4 h-4 rounded text-emerald-500 focus:ring-0"
                                        />
                                        <span className="text-xs font-black text-white uppercase tracking-wider">Kiosko Autoservicio</span>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800 hover:border-slate-700 cursor-pointer transition-all">
                                        <input
                                            type="checkbox"
                                            checked={formModQr}
                                            onChange={e => setFormModQr(e.target.checked)}
                                            className="w-4 h-4 rounded text-emerald-500 focus:ring-0"
                                        />
                                        <span className="text-xs font-black text-white uppercase tracking-wider">Menú QR Digital</span>
                                    </label>
                                </div>
                            </div>

                            {/* Features */}
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                                    Características y Beneficios (un ítem por línea)
                                </label>
                                <textarea
                                    rows={3}
                                    value={formFeaturesText}
                                    onChange={e => setFormFeaturesText(e.target.value)}
                                    placeholder="Comandeo móvil para meseros&#10;Pantalla de Cocina KDS en tiempo real&#10;Digitalización completa del menú"
                                    className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-3 text-white text-xs font-medium focus:border-emerald-500 outline-none resize-none"
                                />
                            </div>

                            {/* Flags & Stripe */}
                            <div className="space-y-3 bg-slate-950/40 p-5 rounded-2xl border border-slate-800">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="text-xs font-black text-white uppercase tracking-wider">Plan Activo y Disponible</span>
                                    <input
                                        type="checkbox"
                                        checked={formIsActive}
                                        onChange={e => setFormIsActive(e.target.checked)}
                                        className="w-4 h-4 rounded text-emerald-500"
                                    />
                                </label>
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="text-xs font-black text-white uppercase tracking-wider">Marcar como Más Popular / Recomendado</span>
                                    <input
                                        type="checkbox"
                                        checked={formIsPopular}
                                        onChange={e => setFormIsPopular(e.target.checked)}
                                        className="w-4 h-4 rounded text-orange-500"
                                    />
                                </label>
                                <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-800">
                                    <div>
                                        <span className="text-xs font-black text-emerald-400 uppercase tracking-wider block">Sincronizar con Stripe</span>
                                        <span className="text-[10px] text-slate-500 font-medium">Crea o actualiza el Product y Price recurrente en Stripe</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={syncStripeOption}
                                        onChange={e => setSyncStripeOption(e.target.checked)}
                                        className="w-4 h-4 rounded text-emerald-500"
                                    />
                                </label>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsPlanModalOpen(false)}
                                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black rounded-xl text-xs uppercase tracking-wider transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingPlan}
                                    className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95"
                                >
                                    {savingPlan && <Loader2 className="w-4 h-4 animate-spin" />}
                                    <span>{savingPlan ? 'Guardando...' : (editingPlan ? 'Actualizar Plan' : 'Guardar Plan')}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Asignar Plan a Restaurante */}
            {assignModalOpen && planToAssign && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-slate-800 rounded-[3rem] w-full max-w-lg p-8 overflow-hidden shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div>
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block mb-1">
                                    Asignación Comercial
                                </span>
                                <h2 className="text-xl font-black text-white italic uppercase tracking-tight">
                                    Asignar Plan a Restaurante
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setAssignModalOpen(false)}
                                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Plan Info Card */}
                        <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-black text-white uppercase">{planToAssign.name}</span>
                                <span className="text-emerald-400 font-black text-sm">${planToAssign.monthly_price}/mes</span>
                            </div>
                            <p className="text-[11px] text-slate-400">{planToAssign.description}</p>
                            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                                <span>Setup fee: ${planToAssign.setup_fee}</span>
                                <span>Pantallas: {planToAssign.max_screens === 0 ? 'Ilimitadas' : planToAssign.max_screens}</span>
                            </div>
                        </div>

                        {/* Select Restaurant */}
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                                Selecciona el Restaurante Cliente
                            </label>
                            <select
                                value={targetRestaurantId}
                                onChange={e => setTargetRestaurantId(e.target.value)}
                                className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-3.5 text-white text-xs font-black uppercase tracking-wider focus:border-emerald-500 outline-none"
                            >
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} ({c.email || 'Sin correo'}) — Costo actual: ${c.unit_price || 49}/mes
                                    </option>
                                ))}
                            </select>
                            <p className="text-[10px] text-slate-500 mt-2">
                                Al confirmar, se actualizará el costo unitario del restaurante en la base de datos a <strong className="text-emerald-400">${planToAssign.monthly_price}/mes</strong>.
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={() => setAssignModalOpen(false)}
                                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black rounded-xl text-xs uppercase tracking-wider transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={assigningPlan || !targetRestaurantId}
                                onClick={handleAssignPlanSubmit}
                                className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95"
                            >
                                {assigningPlan && <Loader2 className="w-4 h-4 animate-spin" />}
                                <span>{assigningPlan ? 'Asignando...' : 'Confirmar Asignación'}</span>
                            </button>
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
