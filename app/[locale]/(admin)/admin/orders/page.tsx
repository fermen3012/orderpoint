'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/browser';
import { useAuth } from '@/components/auth/AuthContext';
import { formatPrice } from '@/lib/utils';
import {
    Search,
    ShoppingBag,
    Eye,
    Clock,
    CheckCircle2,
    XCircle,
    Utensils,
    Filter,
    Calendar,
    Loader2,
    RefreshCw,
    Download,
    X as CloseIcon
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OrderItem {
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    modifiers_json: any;
    removed_ingredients: any;
    products?: {
        name: any;
    };
}

interface Order {
    id: string;
    restaurant_id: string;
    total_amount: number;
    status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
    order_number: number;
    order_type: 'dine_in' | 'takeout';
    created_at: string;
    preparing_at?: string | null;
    ready_at?: string | null;
    completed_at?: string | null;
    order_items: OrderItem[];
}

const getLocalizedValue = (field: any, currentLang: string): string => {
    if (!field) return '';
    let current = field;
    for (let i = 0; i < 5; i++) {
        if (typeof current === 'string') {
            const trimmed = current.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (parsed !== null && parsed !== undefined) {
                        current = parsed;
                        continue;
                    }
                } catch (e) {
                    try {
                        const fixed = trimmed.replace(/""/g, '"');
                        const parsed = JSON.parse(fixed);
                        if (parsed !== null && parsed !== undefined) {
                            current = parsed;
                            continue;
                        }
                    } catch (err) {}
                }
            }
            break;
        } else if (current && typeof current === 'object') {
            const foundKey = Object.keys(current).find(pk => pk.toLowerCase() === currentLang.toLowerCase());
            if (foundKey) {
                current = current[foundKey];
            } else {
                const esKey = Object.keys(current).find(pk => pk.toLowerCase() === 'es');
                if (esKey) {
                    current = current[esKey];
                } else {
                    const firstKey = Object.keys(current)[0];
                    current = firstKey ? current[firstKey] : '';
                }
            }
        } else {
            break;
        }
    }
    return typeof current === 'string' ? current : (current ? String(current) : '');
};

export default function OrdersPage() {
    const t = useTranslations('admin');
    const locale = useLocale();
    const { restaurantId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);
    const [restaurantName, setRestaurantName] = useState<string>('');
    
    // Filters State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [dateFilter, setDateFilter] = useState<'today' | 'all'>('today');

    // Live Ticker for preparing time
    const [now, setNow] = useState(new Date());

    // Details Modal
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    const supabase = createClient();

    const loadOrders = async () => {
        if (!restaurantId) return;
        try {
            const { data, error } = await (supabase
                .from('orders') as any)
                .select(`
                    *,
                    order_items (
                        *,
                        products (
                            name
                        )
                    )
                `)
                .eq('restaurant_id', restaurantId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) {
                setOrders(data as Order[]);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchRestaurantName = async () => {
            if (!restaurantId) return;
            try {
                const { data, error } = await supabase
                    .from('restaurants')
                    .select('name')
                    .eq('id', restaurantId)
                    .single() as { data: any, error: any };

                if (data && !error) {
                    setRestaurantName(data.name);
                }
            } catch (err) {
                console.error('Error fetching restaurant name:', err);
            }
        };

        if (restaurantId) {
            fetchRestaurantName();
            loadOrders();

            // Subscribe to real-time order updates
            const channel = supabase
                .channel(`admin-restaurant-orders-${restaurantId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'orders',
                        filter: `restaurant_id=eq.${restaurantId}`
                    },
                    () => {
                        loadOrders();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [restaurantId]);

    // Live Ticker Interval
    useEffect(() => {
        const interval = setInterval(() => {
            setNow(new Date());
        }, 10000); // refresh every 10s
        return () => clearInterval(interval);
    }, []);

    // Filter Logic
    const filteredOrders = orders.filter(order => {
        // Search Term Filter (Order Number)
        const orderNumStr = `#${order.order_number}`;
        if (searchTerm && !orderNumStr.includes(searchTerm) && !String(order.order_number).includes(searchTerm)) {
            return false;
        }

        // Status Filter
        if (statusFilter !== 'all' && order.status !== statusFilter) {
            return false;
        }

        // Order Type Filter
        if (typeFilter !== 'all' && order.order_type !== typeFilter) {
            return false;
        }

        // Date Filter
        if (dateFilter === 'today') {
            const todayStr = new Date().toDateString();
            const orderDateStr = new Date(order.created_at).toDateString();
            if (todayStr !== orderDateStr) {
                return false;
            }
        }

        return true;
    });

    const getStatusStyles = (status: Order['status']) => {
        switch (status) {
            case 'pending':
                return {
                    bg: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
                    label: t('statusPending')
                };
            case 'preparing':
                return {
                    bg: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                    label: t('statusPreparing')
                };
            case 'ready':
                return {
                    bg: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
                    label: t('statusReady')
                };
            case 'completed':
                return {
                    bg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
                    label: t('statusCompleted')
                };
            case 'cancelled':
                return {
                    bg: 'bg-red-500/10 text-red-500 border-red-500/20',
                    label: t('statusCancelled')
                };
        }
    };

    const getPreparationTime = (order: Order) => {
        const start = order.preparing_at || order.created_at;
        const end = order.ready_at || order.completed_at;

        if (order.status === 'pending') {
            return t('prepStatusWaiting');
        }
        
        if (order.status === 'cancelled') {
            return t('prepStatusCancelled');
        }

        if (end && start) {
            const diff = new Date(end).getTime() - new Date(start).getTime();
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            return `${minutes}m ${seconds}s`;
        }

        if (order.status === 'preparing' && start) {
            const diff = now.getTime() - new Date(start).getTime();
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            return t('prepStatusPreparing', { time: `${minutes}m ${seconds}s` });
        }

        return '—';
    };

    const downloadPDF = () => {
        const doc = new jsPDF();
        
        // Title: Restaurant Name
        doc.setTextColor(30, 41, 59); // Slate-800
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.text(restaurantName || 'ORDERPOINT', 15, 20);
        
        // Subtitle: Report Name
        doc.setFontSize(12);
        doc.setTextColor(71, 85, 105); // Slate-600
        doc.text(locale === 'es' ? 'REPORTE DE PEDIDOS / ORDERS REPORT' : 'ORDERS REPORT', 15, 28);
        
        // Subtitle/Metadata
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139); // Slate-500
        doc.text(`${locale === 'es' ? 'Generado el' : 'Generated on'}: ${new Date().toLocaleString()}`, 15, 36);
        doc.text(`${locale === 'es' ? 'Filtro' : 'Filter'}: ${statusFilter.toUpperCase()} | ${typeFilter.toUpperCase()} | ${dateFilter === 'today' ? (locale === 'es' ? 'HOY' : 'TODAY') : (locale === 'es' ? 'HISTORIAL' : 'HISTORY')}`, 15, 42);
        doc.text(`${locale === 'es' ? 'Pedidos en lista' : 'Orders in list'}: ${filteredOrders.length}`, 195, 36, { align: 'right' });
        
        // Horizontal line separator
        doc.setDrawColor(226, 232, 240); // Slate-200
        doc.setLineWidth(0.5);
        doc.line(15, 46, 195, 46);

        // Map table rows
        const tableBody = filteredOrders.map(order => {
            const statusInfo = getStatusStyles(order.status);
            return [
                `${locale === 'es' ? 'ORDEN' : 'ORDER'} #${order.order_number}\n(${order.order_type === 'dine_in' ? (locale === 'es' ? 'Kiosco' : 'Kiosk') : (locale === 'es' ? 'Llevar' : 'Takeout')})`,
                order.order_items.map(item => `x${item.quantity} ${getLocalizedValue(item.products?.name, locale)}`).join('\n'),
                formatPrice(order.total_amount, locale === 'es' ? 'es-SV' : 'en-US'),
                getPreparationTime(order),
                statusInfo.label
            ];
        });

        autoTable(doc, {
            startY: 52,
            margin: { left: 15, right: 15 },
            head: [[
                locale === 'es' ? 'Pedido' : 'Order',
                locale === 'es' ? 'Productos' : 'Products',
                locale === 'es' ? 'Total' : 'Total',
                locale === 'es' ? 'Tiempo Prep.' : 'Prep. Time',
                locale === 'es' ? 'Estado' : 'Status'
            ]],
            body: tableBody,
            theme: 'grid',
            headStyles: { 
                fillColor: [15, 23, 42], // Dark slate (clean and elegant for print)
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'left'
            },
            styles: { 
                font: 'helvetica', 
                fontSize: 8.5,
                cellPadding: 4,
                valign: 'middle'
            },
            columnStyles: {
                0: { cellWidth: 28 },
                1: { cellWidth: 75 },
                2: { cellWidth: 21 },
                3: { cellWidth: 30 },
                4: { cellWidth: 26 }
            }
        });

        doc.save(`pedidos_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    return (
        <div className="p-4 md:p-8 lg:p-10 pb-32">
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-10">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-8 h-1 bg-emerald-500 rounded-full"></span>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">{t('operations')}</span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        {t('orders')}
                    </h1>
                    <p className="text-slate-400 font-bold mt-3 text-[10px] uppercase tracking-widest">
                        {t('ordersHistoryDesc')}
                    </p>
                </div>

                <div className="flex flex-wrap gap-4 w-full lg:w-auto">
                    <button
                        onClick={downloadPDF}
                        disabled={loading || filteredOrders.length === 0}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-slate-950 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-[0_10px_20px_rgba(16,185,129,0.15)]"
                    >
                        <Download className="w-4 h-4" />
                        <span>{t('downloadPdf')}</span>
                    </button>

                    <button
                        onClick={loadOrders}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 border border-slate-800 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:text-white transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        <span>{t('update')}</span>
                    </button>
                </div>
            </header>

            {/* Filter Section */}
            <div className="space-y-6 bg-slate-900/40 border border-slate-800/80 rounded-[2.5rem] p-6 lg:p-8 mb-8 backdrop-blur-md">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Search Field */}
                    <div className="relative group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
                        <input
                            type="text"
                            placeholder={t('searchOrderPlaceholder')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-slate-955 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-white text-[10px] uppercase tracking-widest"
                        />
                    </div>

                    {/* Status Filter */}
                    <div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-5 py-4 bg-slate-955 border border-slate-800 rounded-2xl focus:border-emerald-500 outline-none transition-all font-black text-white text-[10px] uppercase tracking-widest cursor-pointer"
                        >
                            <option value="all">{t('allStatuses')}</option>
                            <option value="pending">{locale === 'es' ? 'PENDIENTES' : 'PENDING'}</option>
                            <option value="preparing">{locale === 'es' ? 'PREPARANDO' : 'PREPARING'}</option>
                            <option value="ready">{locale === 'es' ? 'LISTOS' : 'READY'}</option>
                            <option value="completed">{locale === 'es' ? 'COMPLETADOS' : 'COMPLETED'}</option>
                            <option value="cancelled">{locale === 'es' ? 'CANCELADOS' : 'CANCELLED'}</option>
                        </select>
                    </div>

                    {/* Order Type Filter */}
                    <div>
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="w-full px-5 py-4 bg-slate-955 border border-slate-800 rounded-2xl focus:border-emerald-500 outline-none transition-all font-black text-white text-[10px] uppercase tracking-widest cursor-pointer"
                        >
                            <option value="all">{t('allTypes')}</option>
                            <option value="dine_in">{t('kioskOption')}</option>
                            <option value="takeout">{t('takeoutOption')}</option>
                        </select>
                    </div>

                    {/* Date Toggle */}
                    <div className="flex bg-slate-955 border border-slate-800 p-1.5 rounded-2xl">
                        <button
                            onClick={() => setDateFilter('today')}
                            className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                                dateFilter === 'today'
                                    ? 'bg-emerald-500 text-slate-955'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            {t('todayOption')}
                        </button>
                        <button
                            onClick={() => setDateFilter('all')}
                            className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                                dateFilter === 'all'
                                    ? 'bg-emerald-500 text-slate-955'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            {t('historyOption')}
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                    <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px]">{t('loadingData')}</p>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 bg-slate-900/20 border border-slate-800/50 rounded-[3rem] text-slate-500 gap-4">
                    <ShoppingBag className="w-12 h-12 text-slate-700" />
                    <p className="font-black uppercase tracking-widest text-[10px]">{t('noOrdersFound')}</p>
                </div>
            ) : (
                <>
                    {/* Desktop Table View */}
                    <div className="hidden lg:block bg-slate-900/40 backdrop-blur-sm rounded-[3rem] border border-slate-800 overflow-hidden shadow-lg">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left">
                                <thead className="bg-slate-955/20 border-b border-slate-800/50">
                                    <tr>
                                        <th className="px-10 py-8 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">{t('tableColOrder')}</th>
                                        <th className="px-10 py-8 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">{t('tableColProducts')}</th>
                                        <th className="px-10 py-8 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">{t('tableColTotal')}</th>
                                        <th className="px-10 py-8 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">{t('tableColPrepTime')}</th>
                                        <th className="px-10 py-8 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">{t('tableColStatus')}</th>
                                        <th className="px-10 py-8 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">{t('tableColActions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {filteredOrders.map((order) => {
                                        const statusInfo = getStatusStyles(order.status);
                                        return (
                                            <tr key={order.id} className="group hover:bg-slate-800/20 transition-all duration-300">
                                                {/* Pedido */}
                                                <td className="px-10 py-8">
                                                    <div>
                                                        <span className="font-black text-white text-lg italic tracking-tighter uppercase leading-none block">
                                                            {locale === 'es' ? 'ORDEN' : 'ORDER'} #{order.order_number}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1 block">
                                                            {order.order_type === 'dine_in' ? (locale === 'es' ? 'Kiosco' : 'Kiosk') : (locale === 'es' ? 'Llevar' : 'Takeout')} • {new Date(order.created_at).toLocaleTimeString(locale === 'es' ? 'es-SV' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </td>
                                                {/* Productos */}
                                                <td className="px-10 py-8">
                                                    <div className="space-y-1 max-w-xs">
                                                        {order.order_items.map((item, idx) => (
                                                            <div key={item.id || idx} className="text-xs text-slate-300 font-bold truncate">
                                                                <span className="text-emerald-500 font-black mr-1.5">x{item.quantity}</span>
                                                                {getLocalizedValue(item.products?.name, locale)}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                                {/* Total */}
                                                <td className="px-10 py-8">
                                                    <span className="font-black text-emerald-500 text-lg italic tracking-tighter">
                                                        {formatPrice(order.total_amount, locale === 'es' ? 'es-SV' : 'en-US')}
                                                    </span>
                                                </td>
                                                {/* Tiempo Prep */}
                                                <td className="px-10 py-8">
                                                    <span className={`text-xs font-black uppercase tracking-wider ${
                                                        order.status === 'preparing' ? 'text-blue-400 animate-pulse' : 'text-slate-300'
                                                    }`}>
                                                        {getPreparationTime(order)}
                                                    </span>
                                                </td>
                                                {/* Estado */}
                                                <td className="px-10 py-8">
                                                    <span className={`inline-block px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${statusInfo.bg}`}>
                                                        {statusInfo.label}
                                                    </span>
                                                </td>
                                                {/* Acciones */}
                                                <td className="px-10 py-8 text-right">
                                                    <button
                                                        onClick={() => setSelectedOrder(order)}
                                                        className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-955 border border-slate-800 text-slate-400 rounded-xl font-black text-[9px] uppercase tracking-wider hover:text-white transition-colors"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                        <span>{t('viewDetail')}</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Card View */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:hidden">
                        {filteredOrders.map((order) => {
                            const statusInfo = getStatusStyles(order.status);
                            return (
                                <div
                                    key={order.id}
                                    className="bg-slate-900/40 border border-slate-800/80 hover:border-slate-700/80 rounded-[2.5rem] p-6 flex flex-col justify-between transition-all duration-300 group shadow-lg"
                                >
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="font-black text-2xl text-white italic tracking-tighter">
                                                    {locale === 'es' ? 'ORDEN' : 'ORDER'} #{order.order_number}
                                                </span>
                                                <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${statusInfo.bg}`}>
                                                    {statusInfo.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                                                <Clock className="w-3.5 h-3.5" />
                                                <span>
                                                    {new Date(order.created_at).toLocaleTimeString(locale === 'es' ? 'es-SV' : 'en-US', {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </span>
                                                <span className="text-slate-700">•</span>
                                                <span className="text-slate-400">
                                                    {order.order_type === 'dine_in' ? (locale === 'es' ? 'Kiosco' : 'Kiosk') : (locale === 'es' ? 'Llevar' : 'Takeout')}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <p className="text-slate-500 text-[8px] font-black uppercase tracking-wider mb-1">{t('tableColTotal')}</p>
                                            <span className="text-2xl font-black text-emerald-500 italic tracking-tighter">
                                                {formatPrice(order.total_amount, locale === 'es' ? 'es-SV' : 'en-US')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="h-px bg-slate-800/60 my-2"></div>

                                    {/* Items Preview */}
                                    <div className="space-y-2.5 my-4">
                                        {order.order_items.map((item, idx) => (
                                            <div key={item.id || idx} className="flex justify-between text-xs font-bold text-slate-300">
                                                <span className="truncate max-w-[80%]">
                                                    <span className="text-emerald-500 font-black mr-2">x{item.quantity}</span>
                                                    {getLocalizedValue(item.products?.name, locale)}
                                                </span>
                                                <span className="text-slate-500 font-bold">
                                                    {formatPrice(Number(item.unit_price) * item.quantity, locale === 'es' ? 'es-SV' : 'en-US')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="h-px bg-slate-800/60 my-2"></div>

                                    {/* Preparation Time and View Button */}
                                    <div className="flex items-center justify-between mt-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-500 text-[8px] font-black uppercase tracking-wider">{t('tableColPrepTime')}:</span>
                                            <span className={`text-xs font-black uppercase tracking-wider ${
                                                order.status === 'preparing' ? 'text-blue-400 animate-pulse' : 'text-slate-300'
                                            }`}>
                                                {getPreparationTime(order)}
                                            </span>
                                        </div>

                                        <button
                                            onClick={() => setSelectedOrder(order)}
                                            className="flex items-center gap-2 px-5 py-3 bg-slate-955 border border-slate-800 text-slate-400 rounded-xl font-black text-[9px] uppercase tracking-wider hover:text-white transition-colors"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            <span>{t('viewDetail')}</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Modal Order Details */}
            {selectedOrder && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-955/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 w-full max-w-2xl rounded-[3rem] border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 flex justify-between items-start border-b border-slate-800/50">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-emerald-500 rounded-3xl flex flex-col items-center justify-center shadow-[0_10px_30px_rgba(16,185,129,0.3)]">
                                    <span className="text-[10px] font-black text-slate-900 uppercase">{t('tableColOrder')}</span>
                                    <span className="text-2xl font-black text-slate-900 tracking-tighter">#{selectedOrder.order_number}</span>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-1">{t('orderDetails')}</h2>
                                    <p className="text-slate-500 font-bold text-sm">
                                        {t('processedOn', {
                                            date: new Date(selectedOrder.created_at).toLocaleDateString(locale === 'es' ? 'es-SV' : 'en-US'),
                                            time: new Date(selectedOrder.created_at).toLocaleTimeString(locale === 'es' ? 'es-SV' : 'en-US', { hour: '2-digit', minute: '2-digit' })
                                        })}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="p-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl transition-all"
                            >
                                <CloseIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-8 max-h-[50vh] overflow-y-auto custom-scrollbar space-y-4">
                            {selectedOrder.order_items.map((item) => (
                                <div key={item.id} className="flex gap-6 p-6 bg-slate-955/50 rounded-[2rem] border border-slate-800/50">
                                    <div className="w-12 h-12 bg-slate-800 text-white rounded-2xl flex items-center justify-center font-black text-xl border border-slate-700">
                                        {item.quantity}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">
                                                {getLocalizedValue(item.products?.name, locale)}
                                            </h3>
                                            <span className="font-black text-emerald-500 text-lg">
                                                {formatPrice(Number(item.unit_price) * item.quantity, locale === 'es' ? 'es-SV' : 'en-US')}
                                            </span>
                                        </div>
                                        
                                        {/* Modifiers display inside list */}
                                        {item.modifiers_json && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {item.modifiers_json.map((mod: any, idx: number) => (
                                                    <span key={idx} className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-800 px-2.5 py-1 rounded-lg">
                                                        {mod.options.map((o: any) => o.name).join(', ')}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Removed ingredients */}
                                        {item.removed_ingredients && item.removed_ingredients.length > 0 && (
                                            <div className="text-[9px] font-black text-red-500 uppercase tracking-widest mt-1">
                                                {locale === 'es' ? 'Sin' : 'No'}: {item.removed_ingredients.map((ri: any) => ri.name || ri).join(', ')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-8 bg-slate-955/50 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-8">
                            <div className="flex flex-col">
                                <span className="text-slate-500 text-[10px] font-black uppercase tracking-wider">{t('tableColPrepTime')}</span>
                                <span className="text-lg font-black text-white tracking-widest uppercase">
                                    {getPreparationTime(selectedOrder)}
                                </span>
                            </div>
                            
                            <div>
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">{t('totalAmount')}</p>
                                <p className="text-4xl font-black text-white italic tracking-tighter">
                                    {formatPrice(Number(selectedOrder.total_amount), locale === 'es' ? 'es-SV' : 'en-US')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
