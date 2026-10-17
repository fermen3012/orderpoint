'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
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
    X as CloseIcon,
    Smartphone,
    Monitor,
    User,
    RotateCcw,
    DollarSign
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
    table?: { number: string } | null;
    tables?: { number: string } | null;
    table_id?: string | null;
    waitress_id?: string | null;
    source?: string | null;
    waitress?: { full_name: string } | null;
}

const getOrderOrigin = (order: Order, locale: string) => {
    const isExoServer = order.source === 'exo_server' || order.source === 'exo_server_closed' || Boolean(order.waitress_id || order.waitress || order.table_id || order.table);
    const tableNum = order.table?.number || order.tables?.number;
    const waitressName = order.waitress?.full_name;

    if (isExoServer) {
        const parts = ['Exo Server'];
        if (waitressName) {
            parts.push(locale === 'es' ? `Mesera: ${waitressName}` : `Waitress: ${waitressName}`);
        }
        if (tableNum) {
            parts.push(locale === 'es' ? `Mesa #${tableNum}` : `Table #${tableNum}`);
        }
        return {
            isExoServer: true,
            sourceLabel: 'Exo Server',
            waitressName: waitressName || null,
            tableNum: tableNum || null,
            pdfOrigin: parts.join(' • ')
        };
    }

    const typeLabel = order.order_type === 'takeout'
        ? (locale === 'es' ? 'Llevar' : 'Takeout')
        : (locale === 'es' ? 'Comer Aquí' : 'Dine In');

    return {
        isExoServer: false,
        sourceLabel: locale === 'es' ? 'Kiosko' : 'Kiosk',
        waitressName: null,
        tableNum: null,
        pdfOrigin: `${locale === 'es' ? 'Kiosko' : 'Kiosk'} • ${locale === 'es' ? `Orden #${order.order_number}` : `Order #${order.order_number}`} (${typeLabel})`
    };
};

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
    const [sourceFilter, setSourceFilter] = useState<'all' | 'kiosk' | 'exo_server'>('all');
    const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all'>('today');
    const [customDate, setCustomDate] = useState<string>('');

    // Live Ticker for preparing time
    const [now, setNow] = useState(new Date());

    // Details Modal
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    const supabase = createClient();

    const loadOrders = useCallback(async () => {
        if (!restaurantId) return;
        if (dateFilter === 'custom' && !customDate) return;

        try {
            const currentNow = new Date();
            let startIso: string | null = null;
            let endIso: string | null = null;
            let rowLimit = 300;

            if (dateFilter === 'today') {
                const start = new Date(currentNow.getFullYear(), currentNow.getMonth(), currentNow.getDate(), 0, 0, 0, 0);
                startIso = start.toISOString();
                rowLimit = 300;
            } else if (dateFilter === 'yesterday') {
                const start = new Date(currentNow.getFullYear(), currentNow.getMonth(), currentNow.getDate() - 1, 0, 0, 0, 0);
                const end = new Date(currentNow.getFullYear(), currentNow.getMonth(), currentNow.getDate() - 1, 23, 59, 59, 999);
                startIso = start.toISOString();
                endIso = end.toISOString();
                rowLimit = 300;
            } else if (dateFilter === 'week') {
                const start = new Date(currentNow.getFullYear(), currentNow.getMonth(), currentNow.getDate() - 7, 0, 0, 0, 0);
                startIso = start.toISOString();
                rowLimit = 500;
            } else if (dateFilter === 'month') {
                const start = new Date(currentNow.getFullYear(), currentNow.getMonth(), 1, 0, 0, 0, 0);
                startIso = start.toISOString();
                rowLimit = 1000;
            } else if (dateFilter === 'custom' && customDate) {
                const [y, m, d] = customDate.split('-').map(Number);
                if (y && m && d) {
                    const start = new Date(y, m - 1, d - 1, 0, 0, 0, 0);
                    const end = new Date(y, m - 1, d + 1, 23, 59, 59, 999);
                    startIso = start.toISOString();
                    endIso = end.toISOString();
                }
                rowLimit = 500;
            } else {
                // 'all' history safety cap
                rowLimit = 500;
            }

            let query = (supabase
                .from('orders') as any)
                .select(`
                    id,
                    restaurant_id,
                    total_amount,
                    status,
                    order_number,
                    order_type,
                    created_at,
                    preparing_at,
                    ready_at,
                    completed_at,
                    table_id,
                    waitress_id,
                    source,
                    table:tables (
                        number
                    ),
                    waitress:profiles!waitress_id (
                        full_name
                    ),
                    order_items (
                        id,
                        product_id,
                        quantity,
                        unit_price,
                        modifiers_json,
                        removed_ingredients,
                        products (
                            name
                        )
                    )
                `)
                .eq('restaurant_id', restaurantId);

            if (startIso) {
                query = query.gte('created_at', startIso);
            }
            if (endIso) {
                query = query.lte('created_at', endIso);
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(rowLimit);

            if (error) throw error;
            if (data) {
                setOrders(data as Order[]);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    }, [restaurantId, dateFilter, customDate, supabase]);

    const loadOrdersRef = useRef(loadOrders);
    useEffect(() => {
        loadOrdersRef.current = loadOrders;
    }, [loadOrders]);

    // Re-fetch when restaurantId, dateFilter, or customDate changes
    useEffect(() => {
        if (restaurantId) {
            loadOrders();
        }
    }, [restaurantId, loadOrders]);

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

            let debounceTimer: ReturnType<typeof setTimeout> | null = null;
            let followUpTimer: ReturnType<typeof setTimeout> | null = null;

            const scheduleReload = (delayMs = 300) => {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    loadOrdersRef.current();
                }, delayMs);
            };

            // Subscribe to real-time order updates isolated by restaurant_id
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
                    (payload: any) => {
                        if (payload.eventType === 'UPDATE' && payload.new) {
                            const updated = payload.new;
                            setOrders(prev => {
                                const exists = prev.some(o => o.id === updated.id);
                                if (!exists) {
                                    scheduleReload(250);
                                    return prev;
                                }
                                return prev.map(o =>
                                    o.id === updated.id
                                        ? {
                                            ...o,
                                            status: updated.status ?? o.status,
                                            total_amount: updated.total_amount ?? o.total_amount,
                                            preparing_at: updated.preparing_at ?? o.preparing_at,
                                            ready_at: updated.ready_at ?? o.ready_at,
                                            completed_at: updated.completed_at ?? o.completed_at,
                                        }
                                        : o
                                );
                            });
                            setSelectedOrder(prev =>
                                prev && prev.id === updated.id
                                    ? {
                                        ...prev,
                                        status: updated.status ?? prev.status,
                                        total_amount: updated.total_amount ?? prev.total_amount,
                                        preparing_at: updated.preparing_at ?? prev.preparing_at,
                                        ready_at: updated.ready_at ?? prev.ready_at,
                                        completed_at: updated.completed_at ?? prev.completed_at,
                                    }
                                    : prev
                            );
                        } else if (payload.eventType === 'DELETE' && payload.old?.id) {
                            setOrders(prev => prev.filter(o => o.id !== payload.old.id));
                        } else {
                            // INSERT: debounce so order_items batch insert completes
                            scheduleReload(300);
                            if (followUpTimer) clearTimeout(followUpTimer);
                            followUpTimer = setTimeout(() => {
                                loadOrdersRef.current();
                            }, 900);
                        }
                    }
                )
                .subscribe();

            return () => {
                if (debounceTimer) clearTimeout(debounceTimer);
                if (followUpTimer) clearTimeout(followUpTimer);
                supabase.removeChannel(channel);
            };
        }
    }, [restaurantId, supabase]);

    // Live Ticker Interval (only ticks when at least one order is actively preparing)
    const hasPreparingOrders = useMemo(
        () => orders.some(o => o.status === 'preparing'),
        [orders]
    );

    useEffect(() => {
        if (!hasPreparingOrders) return;
        const interval = setInterval(() => {
            setNow(new Date());
        }, 10000); // refresh every 10s
        return () => clearInterval(interval);
    }, [hasPreparingOrders]);

    // Memoized Filter Logic (unaffected by the 10s live preparation timer)
    const filteredOrders = useMemo(() => orders.filter(order => {
        const origin = getOrderOrigin(order, locale);
        const term = searchTerm.trim().toLowerCase();

        // 1. Search Term Filter (Number, Waitress, Table, or Product name)
        if (term) {
            const orderNum = String(order.order_number);
            const matchesOrderNum = `#${orderNum}`.includes(term) || orderNum.includes(term);
            const matchesWaitress = origin.waitressName ? origin.waitressName.toLowerCase().includes(term) : false;
            const matchesTable = origin.tableNum ? (`mesa ${origin.tableNum}`.toLowerCase().includes(term) || `table ${origin.tableNum}`.toLowerCase().includes(term) || String(origin.tableNum).toLowerCase().includes(term)) : false;
            const matchesProduct = order.order_items?.some(item => {
                const pName = getLocalizedValue(item.products?.name, locale).toLowerCase();
                return pName.includes(term);
            });

            if (!matchesOrderNum && !matchesWaitress && !matchesTable && !matchesProduct) {
                return false;
            }
        }

        // 2. Channel / Origin Filter
        if (sourceFilter === 'kiosk' && origin.isExoServer) {
            return false;
        }
        if (sourceFilter === 'exo_server' && !origin.isExoServer) {
            return false;
        }

        // 3. Status Filter
        if (statusFilter !== 'all' && order.status !== statusFilter) {
            return false;
        }

        // 4. Order Type Filter
        if (typeFilter !== 'all' && order.order_type !== typeFilter) {
            return false;
        }

        // 5. Date Filter (refines exact local timezone day boundaries)
        if (dateFilter !== 'all') {
            const orderDate = new Date(order.created_at);
            const today = new Date();

            if (dateFilter === 'today') {
                if (orderDate.toDateString() !== today.toDateString()) {
                    return false;
                }
            } else if (dateFilter === 'yesterday') {
                const yesterday = new Date();
                yesterday.setDate(today.getDate() - 1);
                if (orderDate.toDateString() !== yesterday.toDateString()) {
                    return false;
                }
            } else if (dateFilter === 'week') {
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(today.getDate() - 7);
                if (orderDate < sevenDaysAgo) {
                    return false;
                }
            } else if (dateFilter === 'month') {
                if (orderDate.getMonth() !== today.getMonth() || orderDate.getFullYear() !== today.getFullYear()) {
                    return false;
                }
            } else if (dateFilter === 'custom' && customDate) {
                const localOrderDateStr = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`;
                const isoOrderDateStr = orderDate.toISOString().split('T')[0];
                if (localOrderDateStr !== customDate && isoOrderDateStr !== customDate) {
                    return false;
                }
            }
        }

        return true;
    }), [orders, locale, searchTerm, sourceFilter, statusFilter, typeFilter, dateFilter, customDate]);

    const filteredTotalAmount = useMemo(
        () => filteredOrders.reduce((acc, o) => acc + (Number(o.total_amount) || 0), 0),
        [filteredOrders]
    );
    const filteredAverageTicket = filteredOrders.length > 0 ? filteredTotalAmount / filteredOrders.length : 0;
    const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || typeFilter !== 'all' || sourceFilter !== 'all' || dateFilter !== 'today' || customDate !== '';

    const resetFilters = () => {
        setSearchTerm('');
        setStatusFilter('all');
        setTypeFilter('all');
        setSourceFilter('all');
        setDateFilter('today');
        setCustomDate('');
    };

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
        const dateFilterLabel = dateFilter === 'today' ? (locale === 'es' ? 'HOY' : 'TODAY')
            : dateFilter === 'yesterday' ? (locale === 'es' ? 'AYER' : 'YESTERDAY')
            : dateFilter === 'week' ? (locale === 'es' ? '7 DÍAS' : '7 DAYS')
            : dateFilter === 'month' ? (locale === 'es' ? 'ESTE MES' : 'THIS MONTH')
            : dateFilter === 'custom' ? (locale === 'es' ? `FECHA: ${customDate || 'N/A'}` : `DATE: ${customDate || 'N/A'}`)
            : (locale === 'es' ? 'HISTORIAL' : 'ALL HISTORY');
        const sourceFilterLabel = sourceFilter === 'kiosk' ? (locale === 'es' ? 'KIOSKO' : 'KIOSK')
            : sourceFilter === 'exo_server' ? 'EXO SERVER'
            : (locale === 'es' ? 'TODOS CANALES' : 'ALL CHANNELS');
        doc.text(`${locale === 'es' ? 'Filtro' : 'Filter'}: ${sourceFilterLabel} | ${statusFilter.toUpperCase()} | ${typeFilter.toUpperCase()} | ${dateFilterLabel}`, 15, 42);
        doc.text(`${locale === 'es' ? 'Pedidos en lista' : 'Orders in list'}: ${filteredOrders.length}`, 195, 36, { align: 'right' });
        
        // Horizontal line separator
        doc.setDrawColor(226, 232, 240); // Slate-200
        doc.setLineWidth(0.5);
        doc.line(15, 46, 195, 46);

        // Map table rows
        const tableBody = filteredOrders.map(order => {
            const statusInfo = getStatusStyles(order.status);
            const originInfo = getOrderOrigin(order, locale);
            return [
                `${locale === 'es' ? 'ORDEN' : 'ORDER'} #${order.order_number}\n(${originInfo.pdfOrigin})`,
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
            <div className="space-y-6 bg-slate-900/40 border border-slate-800/80 rounded-[2.5rem] p-6 lg:p-8 mb-8 backdrop-blur-md shadow-xl">
                {/* Row 1: Search, Channel, Status, Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Search Field */}
                    <div className="relative group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
                        <input
                            type="text"
                            placeholder={locale === 'es' ? 'BUSCAR ORDEN #, MESERA, MESA O PLATO...' : 'SEARCH ORDER #, WAITRESS, TABLE OR DISH...'}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-955 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-white text-[10px] uppercase tracking-wider"
                        />
                    </div>

                    {/* Channel / Origin Filter */}
                    <div>
                        <select
                            value={sourceFilter}
                            onChange={(e) => setSourceFilter(e.target.value as any)}
                            className="w-full px-5 py-3.5 bg-slate-955 border border-slate-800 rounded-2xl focus:border-emerald-500 outline-none transition-all font-black text-white text-[10px] uppercase tracking-wider cursor-pointer"
                        >
                            <option value="all">{locale === 'es' ? 'TODOS LOS CANALES' : 'ALL CHANNELS'}</option>
                            <option value="kiosk">{locale === 'es' ? 'KIOSKO (AUTOSERVICIO)' : 'KIOSK (SELF-SERVICE)'}</option>
                            <option value="exo_server">{locale === 'es' ? 'EXO SERVER (MESERAS)' : 'EXO SERVER (WAITRESSES)'}</option>
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-5 py-3.5 bg-slate-955 border border-slate-800 rounded-2xl focus:border-emerald-500 outline-none transition-all font-black text-white text-[10px] uppercase tracking-wider cursor-pointer"
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
                            className="w-full px-5 py-3.5 bg-slate-955 border border-slate-800 rounded-2xl focus:border-emerald-500 outline-none transition-all font-black text-white text-[10px] uppercase tracking-wider cursor-pointer"
                        >
                            <option value="all">{t('allTypes')}</option>
                            <option value="dine_in">{locale === 'es' ? 'COMER EN SALA (DINE-IN)' : 'DINE IN'}</option>
                            <option value="takeout">{locale === 'es' ? 'PARA LLEVAR (TAKEOUT)' : 'TAKEOUT'}</option>
                        </select>
                    </div>
                </div>

                {/* Row 2: Date Filters & Custom Date */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 pt-2 border-t border-slate-800/60">
                    {/* Date Pills */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mr-1 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                            {locale === 'es' ? 'FECHA:' : 'DATE:'}
                        </span>

                        {[
                            { id: 'today', labelEs: 'Hoy', labelEn: 'Today' },
                            { id: 'yesterday', labelEs: 'Ayer', labelEn: 'Yesterday' },
                            { id: 'week', labelEs: '7 Días', labelEn: '7 Days' },
                            { id: 'month', labelEs: 'Este Mes', labelEn: 'This Month' },
                            { id: 'all', labelEs: 'Historial', labelEn: 'All History' },
                            { id: 'custom', labelEs: 'Personalizada', labelEn: 'Custom' }
                        ].map((df) => {
                            const active = dateFilter === df.id;
                            return (
                                <button
                                    key={df.id}
                                    type="button"
                                    onClick={() => setDateFilter(df.id as any)}
                                    className={`px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                                        active
                                            ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                                            : 'bg-slate-955 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                                    }`}
                                >
                                    {locale === 'es' ? df.labelEs : df.labelEn}
                                </button>
                            );
                        })}
                    </div>

                    {/* Custom Date Input (shown if 'custom' is selected) */}
                    {dateFilter === 'custom' && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                            <input
                                type="date"
                                value={customDate}
                                onChange={(e) => setCustomDate(e.target.value)}
                                className="px-4 py-2 bg-slate-955 border border-emerald-500/50 rounded-xl font-black text-white text-[10px] outline-none focus:ring-2 focus:ring-emerald-500/20"
                            />
                        </div>
                    )}
                </div>

                {/* Row 3: Live Summary Metrics & Reset */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800/60">
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Count Badge */}
                        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-955 border border-slate-800 rounded-xl">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{locale === 'es' ? 'RESULTADOS:' : 'RESULTS:'}</span>
                            <span className="text-[11px] font-black text-emerald-400">{filteredOrders.length} {locale === 'es' ? 'pedidos' : 'orders'}</span>
                        </div>

                        {/* Amount Badge */}
                        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-955 border border-slate-800 rounded-xl">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{locale === 'es' ? 'TOTAL FACTURADO:' : 'TOTAL BILLED:'}</span>
                            <span className="text-[11px] font-black text-white italic">
                                {formatPrice(filteredTotalAmount, locale === 'es' ? 'es-SV' : 'en-US')}
                            </span>
                        </div>

                        {/* Avg Ticket Badge */}
                        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-955 border border-slate-800 rounded-xl">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{locale === 'es' ? 'TICKET PROMEDIO:' : 'AVG TICKET:'}</span>
                            <span className="text-[11px] font-black text-amber-400 italic">
                                {formatPrice(filteredAverageTicket, locale === 'es' ? 'es-SV' : 'en-US')}
                            </span>
                        </div>
                    </div>

                    {/* Reset Button */}
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={resetFilters}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all active:scale-95"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{locale === 'es' ? 'LIMPIAR FILTROS' : 'RESET FILTERS'}</span>
                        </button>
                    )}
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
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <span className="font-black text-white text-lg italic tracking-tighter uppercase leading-none block">
                                                                {locale === 'es' ? 'ORDEN' : 'ORDER'} #{order.order_number}
                                                            </span>
                                                            {(() => {
                                                                const origin = getOrderOrigin(order, locale);
                                                                return origin.isExoServer ? (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                                                        <Smartphone className="w-2.5 h-2.5" />
                                                                        Exo Server
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                                        <Monitor className="w-2.5 h-2.5" />
                                                                        {locale === 'es' ? 'Kiosko' : 'Kiosk'}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                            {(() => {
                                                                const origin = getOrderOrigin(order, locale);
                                                                return (
                                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                                        {origin.isExoServer ? (
                                                                            <>
                                                                                {origin.waitressName && (
                                                                                    <span className="text-indigo-300 font-black">
                                                                                        {locale === 'es' ? 'Mesera:' : 'Waitress:'} {origin.waitressName}
                                                                                    </span>
                                                                                )}
                                                                                {origin.waitressName && origin.tableNum && <span>•</span>}
                                                                                {origin.tableNum && (
                                                                                    <span className="text-emerald-400 font-black">
                                                                                        {locale === 'es' ? `Mesa #${origin.tableNum}` : `Table #${origin.tableNum}`}
                                                                                    </span>
                                                                                )}
                                                                            </>
                                                                        ) : (
                                                                            <span className="text-amber-400 font-black">
                                                                                {locale === 'es' ? `Kiosko #${order.order_number}` : `Kiosk #${order.order_number}`} ({order.order_type === 'dine_in' ? (locale === 'es' ? 'Comer Aquí' : 'Dine In') : (locale === 'es' ? 'Llevar' : 'Takeout')})
                                                                            </span>
                                                                        )}
                                                                        <span className="text-slate-600">•</span>
                                                                        <span className="text-slate-500">
                                                                            {new Date(order.created_at).toLocaleTimeString(locale === 'es' ? 'es-SV' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
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
                                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                                <span className="font-black text-2xl text-white italic tracking-tighter">
                                                    {locale === 'es' ? 'ORDEN' : 'ORDER'} #{order.order_number}
                                                </span>
                                                <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${statusInfo.bg}`}>
                                                    {statusInfo.label}
                                                </span>
                                                {(() => {
                                                    const origin = getOrderOrigin(order, locale);
                                                    return origin.isExoServer ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                                            <Smartphone className="w-2.5 h-2.5" />
                                                            Exo Server
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                            <Monitor className="w-2.5 h-2.5" />
                                                            {locale === 'es' ? 'Kiosko' : 'Kiosk'}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1.5 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                                                {(() => {
                                                    const origin = getOrderOrigin(order, locale);
                                                    return (
                                                        <>
                                                            {origin.isExoServer ? (
                                                                <>
                                                                    {origin.waitressName && (
                                                                        <span className="text-indigo-300 font-black">
                                                                            {locale === 'es' ? 'Mesera:' : 'Waitress:'} {origin.waitressName}
                                                                        </span>
                                                                    )}
                                                                    {origin.waitressName && origin.tableNum && <span>•</span>}
                                                                    {origin.tableNum && (
                                                                        <span className="text-emerald-400 font-black">
                                                                            {locale === 'es' ? `Mesa #${origin.tableNum}` : `Table #${origin.tableNum}`}
                                                                        </span>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <span className="text-amber-400 font-black">
                                                                    {locale === 'es' ? `Kiosko #${order.order_number}` : `Kiosk #${order.order_number}`} ({order.order_type === 'dine_in' ? (locale === 'es' ? 'Comer Aquí' : 'Dine In') : (locale === 'es' ? 'Llevar' : 'Takeout')})
                                                                </span>
                                                            )}
                                                            <span className="text-slate-700">•</span>
                                                            <div className="flex items-center gap-1 text-slate-500">
                                                                <Clock className="w-3.5 h-3.5" />
                                                                <span>
                                                                    {new Date(order.created_at).toLocaleTimeString(locale === 'es' ? 'es-SV' : 'en-US', {
                                                                        hour: '2-digit',
                                                                        minute: '2-digit'
                                                                    })}
                                                                </span>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
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
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">{t('orderDetails')}</h2>
                                        {(() => {
                                            const origin = getOrderOrigin(selectedOrder, locale);
                                            return origin.isExoServer ? (
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                                    <Smartphone className="w-3 h-3" />
                                                    Exo Server
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                    <Monitor className="w-3 h-3" />
                                                    {locale === 'es' ? 'Kiosko' : 'Kiosk'}
                                                </span>
                                            );
                                        })()}
                                        {(selectedOrder.table?.number || selectedOrder.tables?.number) && (
                                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                {locale === 'es' ? `Mesa #${selectedOrder.table?.number || selectedOrder.tables?.number}` : `Table #${selectedOrder.table?.number || selectedOrder.tables?.number}`}
                                            </span>
                                        )}
                                        {selectedOrder.waitress?.full_name && (
                                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                                {locale === 'es' ? `Mesera: ${selectedOrder.waitress.full_name}` : `Waitress: ${selectedOrder.waitress.full_name}`}
                                            </span>
                                        )}
                                    </div>
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
                                                {locale === 'es' ? 'Sin' : 'No'}: {item.removed_ingredients.map((ri: any) => getLocalizedValue(ri.name || ri, locale)).join(', ')}
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
