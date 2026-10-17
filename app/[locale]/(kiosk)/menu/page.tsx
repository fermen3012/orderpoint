'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase/client';
import { useCartStore } from '@/store/cart-store';
import { ProductCard } from '@/components/kiosk/ProductCard';
import { Cart } from '@/components/kiosk/Cart';
import CartFloatingBar from '@/components/kiosk/CartFloatingBar';
import { ProductModal } from '@/components/kiosk/ProductModal';
import { useBluetoothPrinter } from '@/hooks/useBluetoothPrinter';
import { buildEscPosReceipt, KioskReceiptData } from '@/lib/escpos';
import { printWithRawBT } from '@/lib/rawbt';
import { getModifiersByProduct } from '@/actions/modifiers';
import { getMenuWithSchedule } from '@/actions/products';
import { useKioskMenuCache } from '@/store/kiosk-menu-cache';
import LanguageSwitcher from '@/components/kiosk/LanguageSwitcher';
import { Globe, ShoppingBag, ArrowLeft, Utensils, Search, CheckCircle2, Sparkles, Printer, SlidersHorizontal } from 'lucide-react';
import { useRouter, usePathname } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import type { Database } from '@/lib/supabase/types';
import { useAuth } from '@/components/auth/AuthContext';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Product as UIProduct, ModifierGroup as UIModifierGroup, Modifier as UIModifier, SelectedModifier } from '@/types';
import { createSecureOrder } from '@/actions/secure-orders';

type DBProduct = Database['public']['Tables']['products']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

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
            if (foundKey && current[foundKey] !== '' && current[foundKey] !== null && current[foundKey] !== undefined) {
                current = current[foundKey];
            } else {
                const esKey = Object.keys(current).find(pk => pk.toLowerCase() === 'es');
                if (esKey && current[esKey] !== '' && current[esKey] !== null && current[esKey] !== undefined) {
                    current = current[esKey];
                } else {
                    const nonEmptyKey = Object.keys(current).find(k => current[k] !== '' && current[k] !== null && current[k] !== undefined);
                    current = nonEmptyKey ? current[nonEmptyKey] : '';
                }
            }
        } else {
            break;
        }
    }
    return typeof current === 'string' ? current : (current ? String(current) : '');
};

export default function MenuPage({ params }: { params: Promise<{ locale: string }> }) {
    const resolvedParams = use(params);
    const locale = resolvedParams.locale;
    const t = useTranslations('kiosk');
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const { restaurantId } = useAuth();
    const { addToCart } = useCartStore();

    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<DBProduct[]>([]);
    const [productIngredientsMap, setProductIngredientsMap] = useState<Record<string, any[]>>({});
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [customizingProduct, setCustomizingProduct] = useState<UIProduct | null>(null);
    const [restaurantName, setRestaurantName] = useState<string | null>(null);
    const [lastPlacedOrder, setLastPlacedOrder] = useState<any | null>(null);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

    // Custom Hook para Impresión Térmica Web Bluetooth Silenciosa (Zero-Dialog)
    const {
        status: printerStatus,
        deviceName: printerDeviceName,
        connectPrinter,
        autoConnect,
        printBuffer,
    } = useBluetoothPrinter();

    const lastReceiptDataRef = useRef<KioskReceiptData | null>(null);

    // Función universal de impresión para Kiosko PWA y Android App Pinning
    const sendTicketToPrinter = async (receiptData: KioskReceiptData, userInitiated: boolean = false) => {
        try {
            const receiptBytes = buildEscPosReceipt(receiptData, 48);

            // 1. Verificar o restaurar conexión Web Bluetooth
            let isConnected = printerStatus === 'connected';
            if (!isConnected) {
                // Intentar reconectar automáticamente con la impresora guardada en memoria
                isConnected = await autoConnect();
            }

            // Si el usuario presionó el botón y la impresora no estaba lista, abrir el selector nativo
            if (!isConnected && userInitiated) {
                isConnected = await connectPrinter();
            }

            if (isConnected) {
                const res = await printBuffer(receiptBytes);
                if (res.success) {
                    console.log('[Printer] Impreso exitosamente vía Web Bluetooth en PWA.');
                    return { success: true };
                }
                console.warn('[Printer] Falló transmisión Web Bluetooth:', res.error);
            }

            // 2. Si no es posible Web Bluetooth, intentar RawBT (si WebSocket local está activo)
            const rawOk = await printWithRawBT(receiptBytes);
            return { success: rawOk };
        } catch (err: any) {
            console.error('[Printer] Error al enviar ticket a la impresora:', err);
            return { success: false, error: err.message };
        }
    };

    // Handle category selection from URL
    useEffect(() => {
        const categoryId = searchParams.get('category_id');
        if (categoryId) {
            setActiveCategory(categoryId);
        }
    }, [searchParams]);

    useEffect(() => {
        async function loadData() {
            if (!restaurantId) return;

            // 1. Verificación de Caché en Memoria (Zero-Lag / 0 peticiones al servidor si es reciente)
            const cache = useKioskMenuCache.getState();
            if (cache.isCacheValid(restaurantId)) {
                setCategories(cache.categories);
                setProducts(cache.products);
                setProductIngredientsMap(cache.productIngredientsMap);
                if (cache.restaurantName) setRestaurantName(cache.restaurantName);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                // 2. Carga unificada en paralelo: categorías, menú con modificadores/ingredientes y restaurante en 1 solo viaje
                const [categoriesRes, productsData, restRes] = await Promise.all([
                    (supabase.from('categories') as any).select('*').eq('restaurant_id', restaurantId).order('sort_order'),
                    getMenuWithSchedule(restaurantId, new Date().getDay()),
                    (supabase.from('restaurants') as any).select('name').eq('id', restaurantId).single()
                ]);

                if (restRes?.data?.name) {
                    setRestaurantName(restRes.data.name);
                }

                if (productsData) {
                    setProducts(productsData);

                    // Filtrar categorías con al menos un producto activo
                    let validCategories: Category[] = [];
                    if (categoriesRes.data) {
                        const activeCategoryIds = new Set((productsData as any[]).map(p => p.category_id));
                        validCategories = (categoriesRes.data as any[]).filter((c: any) => activeCategoryIds.has(c.id));
                        setCategories(validCategories);
                    }

                    // Mapeo de ingredientes quitables indexado por ID de producto
                    const map: Record<string, any[]> = {};
                    (productsData as any[]).forEach((p: any) => {
                        if (p.removable_ingredients && p.removable_ingredients.length > 0) {
                            map[p.id] = p.removable_ingredients.map((ri: any) => ({
                                is_removable: true,
                                ingredients: { name: ri.name, id: ri.id }
                            }));
                        }
                    });
                    setProductIngredientsMap(map);

                    // Guardar en la caché en memoria para navegación instantánea
                    useKioskMenuCache.getState().setKioskMenuCache({
                        restaurantId,
                        restaurantName: restRes?.data?.name || null,
                        categories: validCategories,
                        products: productsData,
                        productIngredientsMap: map
                    });
                }
            } catch (error) {
                console.error('Error loading kiosk data:', error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [restaurantId]);

    const handleAddToCart = async (product: any) => {
        // Zero-Lag: Los modificadores e ingredientes ya están en memoria precargados
        const modifierGroups: UIModifierGroup[] = product.modifier_groups || [];
        const removableIngredients = product.removable_ingredients || [];
        const hasRemovableIngredients = removableIngredients.length > 0 || (productIngredientsMap[product.id]?.some((pi: any) => !!pi.is_removable) || false);

        const uiProduct: UIProduct = {
            id: product.id,
            restaurant_id: product.restaurant_id,
            category_id: product.category_id,
            name: product.name,
            description: product.description,
            price: Number(product.price),
            image_url: product.image_url,
            is_available: product.is_available ?? true,
            modifier_groups: modifierGroups,
            removable_ingredients: removableIngredients
        };

        // Si tiene modificadores obligatorios/opcionales o ingredientes quitables, abrir personalización de inmediato (0ms)
        if (modifierGroups.length > 0 || hasRemovableIngredients) {
            setCustomizingProduct(uiProduct);
        } else {
            // Agregar al carrito instantáneamente (0ms)
            addToCart(uiProduct, [], 1);
        }
    };

    const handleOpenCustomization = async (product: any) => {
        // Zero-Lag: Abrir modal de personalización instantáneamente sin llamadas de red ni bloqueo de pantalla
        const modifierGroups: UIModifierGroup[] = product.modifier_groups || [];
        const removableIngredients = product.removable_ingredients || [];

        const uiProduct: UIProduct = {
            id: product.id,
            restaurant_id: product.restaurant_id,
            category_id: product.category_id,
            name: product.name,
            description: product.description,
            price: Number(product.price),
            image_url: product.image_url,
            is_available: product.is_available ?? true,
            modifier_groups: modifierGroups,
            removable_ingredients: removableIngredients
        };

        setCustomizingProduct(uiProduct);
    };

    const handleConfirmAdd = (product: any, selectedModifiers: SelectedModifier[], quantity: number, removedIngredients: { id: string; name: string }[]) => {
        addToCart(product, selectedModifiers, quantity, removedIngredients);
        setCustomizingProduct(null);
    };

    const handleCheckout = async () => {
        const { items, clearCart, orderType } = useCartStore.getState();
        if (items.length === 0 || !restaurantId) return;

        try {
            setLoading(true);

            // EXTRAER DATOS SEGUROS (Solo IDs y Cantidades)
            // No enviamos precios ni totales desde el cliente
            const orderInput = {
                restaurant_id: restaurantId,
                order_type: orderType,
                items: items.map(item => ({
                    product_id: item.product.id,
                    quantity: item.quantity,
                    // Aplanamos los modificadores a una lista de IDs
                    modifier_option_ids: item.selectedModifiers.flatMap(g => g.options.map(opt => opt.id)),
                    removed_ingredients: item.removedIngredients?.map(ri => ri.id) || []
                }))
            };

            // LLAMADA AL SERVIDOR (Aquí ocurre la validación de precio real)
            // Importación dinámica para evitar errores si no está importado arriba, 
            // pero mejor lo agregamos arriba. Asumiré que debo agregarlo.
            const result = await createSecureOrder(orderInput);

            if (!result.success || !result.order) {
                throw new Error(result.error || 'Error creando la orden');
            }

            const order = result.order;

            const ticketData = {
                order_number: order.order_number,
                created_at: order.created_at,
                total_amount: order.total_amount, // Precio real calculado por el servidor
                type: orderType as string,
                items: items.map(item => ({
                    name: getLocalizedValue(item.product.name, locale),
                    quantity: item.quantity,
                    price: item.unitPrice,
                    modifiers: [
                        ...item.selectedModifiers.flatMap(group => group.options.map(opt => ({ 
                            name: getLocalizedValue(opt.name, locale), 
                            price_extra: Number(opt.price), 
                            type: 'extra' as const 
                        }))),
                        ...(item.removedIngredients || []).map(ri => ({
                            name: getLocalizedValue(ri.name, locale),
                            type: 'removal' as const
                        }))
                    ]
                }))
            };

            // Construir buffer ESC/POS e imprimir directamente al servidor GATT de la impresora Bluetooth (Sin window.print)
            const receiptData: KioskReceiptData = {
                restaurantName: restaurantName || 'ORDERPOINT POS',
                orderNumber: order.order_number,
                orderType: orderType,
                createdAt: order.created_at,
                locale: locale,
                totalAmount: Number(order.total_amount),
                items: items.map(item => ({
                    name: getLocalizedValue(item.product.name, locale),
                    quantity: item.quantity,
                    price: item.unitPrice,
                    modifiers: [
                        ...item.selectedModifiers.flatMap(group => group.options.map(opt => ({ 
                            name: getLocalizedValue(opt.name, locale), 
                            priceExtra: Number(opt.price), 
                            type: 'extra' as const 
                        }))),
                        ...(item.removedIngredients || []).map(ri => ({ 
                            name: getLocalizedValue(ri.name, locale), 
                            type: 'removal' as const 
                        }))
                    ]
                }))
            };

            // Guardar ref para posible reimpresión desde el modal
            lastReceiptDataRef.current = receiptData;

            // Enviar a la impresora (Web Bluetooth si está emparejada, o RawBT en Android)
            sendTicketToPrinter(receiptData);

            setLastPlacedOrder(ticketData);
            clearCart();
            setIsCartOpen(false);
            setIsSuccessModalOpen(true);
        } catch (error: any) {
            alert(`${t('orderError')}: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = activeCategory
        ? products.filter((p) => p.category_id === activeCategory)
        : products;

    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen overflow-hidden flex flex-col bg-slate-50 text-slate-900 selection:bg-primary-500 selection:text-white relative">
            {/* Dynamic Background - Restaurant Interior */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <Image
                    src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80"
                    alt="Background"
                    fill
                    priority
                    className="object-cover opacity-40 fixed"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-slate-50/60 to-slate-50/40" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.6)_0%,rgba(248,250,252,0.5)_100%)]" />
            </div>

            <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
                <header className="sticky top-0 z-20 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-lg shadow-slate-200/20 flex items-center justify-between px-8 py-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/categories')}
                            className="p-3 bg-white hover:bg-slate-100 rounded-2xl text-slate-600 transition-colors shadow-sm border border-slate-200/60"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div className="flex flex-col">
                            <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic drop-shadow-sm">
                                {activeCategory ? categories.find(c => c.id === activeCategory)?.name : t('fullMenu')}
                            </h2>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                <Utensils className="w-3 h-3 text-primary-500" />
                                {restaurantName || 'OrderPoint'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Indicador / Botón de Impresora (RawBT en Android o Web Bluetooth) */}
                        <button
                            type="button"
                            onClick={async () => {
                                const isEn = locale.toLowerCase().startsWith('en');
                                if (printerStatus === 'connected') {
                                    // Test por Web Bluetooth si ya está conectada
                                    const testReceipt: KioskReceiptData = {
                                        restaurantName: restaurantName || (isEn ? 'ORDERPOINT KIOSK' : 'ORDERPOINT KIOSCO'),
                                        orderNumber: 1,
                                        orderType: 'TEST',
                                        createdAt: new Date().toISOString(),
                                        locale: locale,
                                        totalAmount: 0,
                                        items: [{ name: isEn ? 'Bluetooth Print Test' : 'Test Impresion Bluetooth', quantity: 1, price: 0 }],
                                        footerText: isEn ? 'BLUETOOTH TEST SUCCESSFUL' : 'PRUEBA BLUETOOTH EXITOSA'
                                    };
                                    await sendTicketToPrinter(testReceipt, true);
                                } else {
                                    // Conectar activamente por Web Bluetooth
                                    const connected = await connectPrinter();
                                    if (connected) {
                                        const testReceipt: KioskReceiptData = {
                                            restaurantName: restaurantName || (isEn ? 'ORDERPOINT KIOSK' : 'ORDERPOINT KIOSCO'),
                                            orderNumber: 1,
                                            orderType: 'TEST',
                                            createdAt: new Date().toISOString(),
                                            locale: locale,
                                            totalAmount: 0,
                                            items: [{ name: isEn ? 'Bluetooth Print Test' : 'Test Impresion Bluetooth', quantity: 1, price: 0 }],
                                            footerText: isEn ? 'PRINTER PAIRED SUCCESSFULLY' : 'IMPRESORA VINCULADA CON EXITO'
                                        };
                                        await sendTicketToPrinter(testReceipt, true);
                                    } else {
                                        // Si no se vinculó Bluetooth, enviar test a RawBT como alternativa
                                        const testReceipt: KioskReceiptData = {
                                            restaurantName: restaurantName || (isEn ? 'ORDERPOINT KIOSK' : 'ORDERPOINT KIOSCO'),
                                            orderNumber: 1,
                                            orderType: 'TEST',
                                            createdAt: new Date().toISOString(),
                                            locale: locale,
                                            totalAmount: 0,
                                            items: [{ name: isEn ? 'RawBT Print Test' : 'Test Impresion RawBT', quantity: 1, price: 0 }],
                                            footerText: isEn ? 'RAWBT TEST SUCCESSFUL' : 'PRUEBA RAWBT EXITOSA'
                                        };
                                        const testBytes = buildEscPosReceipt(testReceipt, 48);
                                        await printWithRawBT(testBytes);
                                    }
                                }
                            }}
                            className={cn(
                                "p-3 rounded-2xl flex items-center gap-2 font-bold text-xs shadow-sm border transition-all active:scale-95",
                                printerStatus === 'connected'
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                    : "bg-white border-orange-200 text-orange-600 hover:border-orange-400"
                            )}
                            title={printerStatus === 'connected' ? `Conectado: ${printerDeviceName}` : "Toca para conectar tu impresora Bluetooth"}
                        >
                            <Printer className="w-5 h-5 text-orange-500" />
                            <span className="hidden md:inline flex items-center gap-1.5">
                                {printerStatus === 'connected' ? (
                                    <>
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                        <span>{printerDeviceName || 'Impresora Lista'}</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                                        <span>Conectar Impresora</span>
                                    </>
                                )}
                            </span>
                        </button>
                        <LanguageSwitcher />
                        <button
                            onClick={() => setIsCartOpen(!isCartOpen)}
                            className="relative p-3 bg-white rounded-2xl text-slate-600 shadow-sm border border-slate-200/60 active:scale-95 transition-all hover:text-primary-500 group"
                        >
                            <ShoppingBag className="w-6 h-6" />
                            <CartCounter />
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-8 py-8 scrollbar-hide">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 pb-32">
                        {filteredProducts.map((product, idx) => (
                            <div key={product.id} className="animate-in fade-in slide-in-from-bottom-5 duration-700 fill-mode-backwards" style={{ animationDelay: `${idx * 50}ms` }}>
                                <div
                                    onClick={() => product.is_available && handleOpenCustomization(product)}
                                    className="group bg-white rounded-[2.5rem] p-4 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-primary-500/10 hover:-translate-y-1 transition-all duration-300 border border-slate-100 h-full flex flex-col cursor-pointer"
                                >
                                    <div className="relative aspect-square rounded-[2rem] overflow-hidden mb-4 bg-slate-100">
                                        {product.image_url ? (
                                            <Image
                                                src={product.image_url}
                                                alt={getLocalizedValue(product.name, locale)}
                                                fill
                                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                                className="object-cover transition-transform duration-700 group-hover:scale-110"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                <Utensils className="w-12 h-12" />
                                            </div>
                                        )}
                                        {!product.is_available && (
                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                                                <span className="bg-red-500 text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest">{t('soldOut')}</span>
                                            </div>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (product.is_available) handleAddToCart(product);
                                            }}
                                            disabled={!product.is_available}
                                            className="absolute bottom-4 right-4 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg text-slate-900 group-hover:bg-primary-500 group-hover:text-white transition-all disabled:opacity-0 disabled:pointer-events-none transform translate-y-20 group-hover:translate-y-0 duration-300"
                                            title={t('addToCart')}
                                        >
                                            <span className="font-bold text-xl">+</span>
                                        </button>
                                    </div>
                                    <div className="flex-1 flex flex-col">
                                        <h3 className="text-xl font-black text-slate-900 leading-tight mb-2 line-clamp-2 uppercase italic tracking-tight group-hover:text-primary-500 transition-colors">
                                            {getLocalizedValue(product.name, locale)}
                                        </h3>
                                        <p className="text-sm text-slate-500 font-medium leading-relaxed mb-4 line-clamp-2 flex-1">
                                            {getLocalizedValue(product.description, locale)}
                                        </p>
                                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50 gap-2">
                                            <span className="text-2xl font-black text-slate-900 tracking-tight">
                                                ${Number(product.price).toFixed(2)}
                                            </span>
                                            {product.is_available && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenCustomization(product);
                                                    }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 border border-orange-500/20 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm"
                                                >
                                                    <SlidersHorizontal className="w-3.5 h-3.5" />
                                                    <span>{t('customize')}</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {filteredProducts.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400 animate-in fade-in">
                            <Search className="w-16 h-16 mb-4 opacity-50" />
                            <p className="font-bold uppercase tracking-widest">{t('noProducts')}</p>
                        </div>
                    )}
                    <CartFloatingBar onOpenCart={() => setIsCartOpen(true)} />
                </div>
            </main>

            {/* Cart Drawer - Keeping existing logic but restyling container */}
            <div className={cn(
                "fixed inset-y-0 right-0 w-full sm:w-[500px] bg-white z-50 transform transition-transform duration-500 ease-spring shadow-[-50px_0_100px_rgba(0,0,0,0.2)] flex flex-col border-l border-slate-100",
                isCartOpen ? "translate-x-0" : "translate-x-full"
            )}>
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md">
                    <div>
                        <h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">{t('myOrder')}</h3>
                        <p className="text-slate-500 text-sm font-bold mt-1">{t('reviewItems')}</p>
                    </div>

                    <button
                        onClick={() => setIsCartOpen(false)}
                        className="p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors group"
                    >
                        <ArrowLeft className="w-6 h-6 rotate-180 text-slate-400 group-hover:text-slate-600" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto bg-slate-50/50">
                    <Cart locale={locale} onCheckout={handleCheckout} />
                </div>
            </div>

            {
                customizingProduct && (
                    <ProductModal
                        open={!!customizingProduct}
                        product={customizingProduct}
                        onClose={() => setCustomizingProduct(null)}
                        onAdd={handleConfirmAdd}
                        locale={locale}
                    />
                )
            }


            {/* Success Modal */}
            {isSuccessModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-500">
                    <div className="bg-white w-full max-w-lg rounded-[3rem] border border-primary-500/20 shadow-[0_0_80px_rgba(16,185,129,0.15)] overflow-hidden animate-in zoom-in-95 duration-500 flex flex-col max-h-[90vh]">
                        <div className="p-8 text-center relative overflow-hidden flex-none">
                            {/* Animated Background Decoration */}
                            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-primary-500/5 to-transparent pointer-events-none" />
                            <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary-500/5 rounded-full blur-3xl opacity-50" />
                            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-primary-500/5 rounded-full blur-3xl opacity-50" />

                            <div className="relative z-10 flex flex-col items-center">
                                <div className="w-20 h-20 bg-primary-500 rounded-[2rem] flex items-center justify-center mb-6 shadow-[0_20px_40px_rgba(16,185,129,0.3)] rotate-3 animate-in zoom-in-50 duration-500">
                                    <CheckCircle2 className="w-10 h-10 text-white" />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-center gap-2">
                                        <Sparkles className="w-5 h-5 text-primary-500 animate-pulse" />
                                        <h3 className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase">{t('orderPlaced')}</h3>
                                        <Sparkles className="w-5 h-5 text-primary-500 animate-pulse" />
                                    </div>
                                    <p className="text-slate-500 font-bold text-sm leading-tight px-4">
                                        {t('orderSuccessMessage')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Ticket & Order Summary */}
                        {lastPlacedOrder && (
                            <div className="px-8 pb-4 flex-1 overflow-y-auto min-h-0 space-y-6 scrollbar-hide">
                                {/* Ticket Number Box */}
                                <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-6 text-center shadow-inner">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('ticket')}</span>
                                    <h4 className="text-6xl font-black text-primary-500 tracking-tighter mt-1">
                                        #{lastPlacedOrder.order_number}
                                    </h4>
                                </div>

                                {/* Order Items Breakdown */}
                                <div className="space-y-4">
                                    <h5 className="text-xs font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100 pb-2">
                                        {t('orderSummary')}
                                    </h5>
                                    
                                    <div className="divide-y divide-slate-100 pr-2 space-y-3">
                                        {lastPlacedOrder.items.map((item: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-start pt-3 first:pt-0">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="bg-slate-100 text-slate-700 text-xs font-black px-2 py-0.5 rounded-md">
                                                            x{item.quantity}
                                                        </span>
                                                        <span className="font-bold text-slate-800 text-sm">
                                                            {item.name}
                                                        </span>
                                                    </div>
                                                    
                                                    {/* Modifiers and Removals */}
                                                    {item.modifiers && item.modifiers.length > 0 && (
                                                        <div className="pl-8 space-y-0.5">
                                                            {item.modifiers.map((mod: any, mIdx: number) => (
                                                                <p key={mIdx} className="text-xs text-slate-400 font-medium">
                                                                    {mod.type === 'extra' ? `+ ${mod.name}` : `- ${mod.name}`}
                                                                </p>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="font-bold text-slate-900 text-sm">
                                                    ${(Number(item.price) * item.quantity).toFixed(2)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Total Box */}
                                    <div className="flex justify-between items-center border-t-2 border-dashed border-slate-100 pt-4 mt-2">
                                        <span className="text-sm font-black text-slate-800 uppercase tracking-wider">{t('total')}</span>
                                        <span className="text-2xl font-black text-slate-900">
                                            ${Number(lastPlacedOrder.total_amount).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex-none space-y-3">
                            <button
                                type="button"
                                onClick={async () => {
                                    if (lastReceiptDataRef.current) {
                                        await sendTicketToPrinter(lastReceiptDataRef.current, true);
                                    }
                                }}
                                className="w-full py-4 bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 border border-orange-500/30 rounded-[2rem] font-black uppercase tracking-wider text-sm transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm"
                            >
                                <Printer className="w-5 h-5 text-orange-500" />
                                <span>{printerStatus === 'connected' ? t('printTicket') : 'Vincular Impresora e Imprimir'}</span>
                            </button>

                            <button
                                onClick={() => {
                                    setIsSuccessModalOpen(false);
                                    setLastPlacedOrder(null);
                                    lastReceiptDataRef.current = null;
                                    router.push('/categories');
                                }}
                                className="w-full py-5 bg-primary-500 hover:bg-primary-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-lg transition-all active:scale-95 shadow-[0_15px_30px_rgba(16,185,129,0.3)]"
                            >
                                {t('continue')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}

function CartCounter() {
    const items = useCartStore((state) => state.items);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const count = items.reduce((acc, item) => acc + item.quantity, 0);

    if (count === 0) return null;

    return (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-sm animate-scale-in">
            {count}
        </span>
    );
}
