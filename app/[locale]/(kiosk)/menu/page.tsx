'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase/client';
import { useCartStore } from '@/store/cart-store';
import { ProductCard } from '@/components/kiosk/ProductCard';
import { Cart } from '@/components/kiosk/Cart';
import CartFloatingBar from '@/components/kiosk/CartFloatingBar';
import { ProductCustomizationModal } from '@/components/kiosk/ProductCustomizationModal';
import { OrderTicket } from '@/components/kiosk/OrderTicket';
import { useReactToPrint } from 'react-to-print';
import { getModifiersByProduct } from '@/actions/modifiers';
import { Globe, ShoppingBag, ArrowLeft, Utensils, Search } from 'lucide-react';
import { useRouter, usePathname } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import type { Database } from '@/lib/supabase/types';
import { useAuth } from '@/components/auth/AuthContext';
import { cn } from '@/lib/utils';
import { Product as UIProduct, ModifierGroup as UIModifierGroup, Modifier as UIModifier, SelectedModifier } from '@/types';

type DBProduct = Database['public']['Tables']['products']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

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
    const [orderToPrint, setOrderToPrint] = useState<any | null>(null);
    const [isCartOpen, setIsCartOpen] = useState(false);

    const ticketRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: ticketRef,
        onAfterPrint: () => setOrderToPrint(null),
    });

    useEffect(() => {
        if (orderToPrint) handlePrint();
    }, [orderToPrint, handlePrint]);

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
            setLoading(true);
            try {
                const [categoriesRes, productsRes] = await Promise.all([
                    supabase.from('categories').select('*').eq('restaurant_id', restaurantId).order('sort_order'),
                    supabase.from('products').select('*').eq('restaurant_id', restaurantId).eq('is_available', true)
                ]);

                if (categoriesRes.data) setCategories(categoriesRes.data);

                if (productsRes.data) {
                    setProducts(productsRes.data);

                    const productIds = productsRes.data.map(p => p.id);
                    if (productIds.length > 0) {
                        const { data: ingredientsData, error: ingError } = await supabase
                            .from('product_ingredients')
                            .select('*, ingredients(name), is_removable')
                            .in('product_id', productIds);

                        if (ingError) {
                            console.error("Error loading ingredients:", ingError);
                        }

                        if (ingredientsData) {
                            const map: Record<string, any[]> = {};
                            ingredientsData.forEach((pi: any) => {
                                if (!map[pi.product_id]) map[pi.product_id] = [];
                                map[pi.product_id].push(pi);
                            });
                            setProductIngredientsMap(map);
                        }
                    } else {
                        setProductIngredientsMap({});
                    }
                }
            } catch (error) {
                console.error('Error loading kiosk data:', error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [restaurantId]);

    useEffect(() => {
        async function loadRestaurant() {
            if (!restaurantId) return;
            const { data } = await supabase.from('restaurants').select('name').eq('id', restaurantId).single() as any;
            if (data) setRestaurantName(data.name);
        }
        loadRestaurant();
    }, [restaurantId]);

    const handleAddToCart = async (product: DBProduct) => {
        setLoading(true);
        try {
            const { data: productWithModifiers, error } = await getModifiersByProduct(product.id);
            if (error) {
                console.error('Error fetching modifiers:', error);

                const hasRemovableIngredients = productIngredientsMap[product.id]?.some((pi: any) => !!pi.is_removable) || false;

                const uiProduct: UIProduct = {
                    id: product.id,
                    name: product.name,
                    description: product.description,
                    price: Number(product.price),
                    image_url: product.image_url,
                    is_available: product.is_available ?? true,
                    modifier_groups: []
                };

                if (hasRemovableIngredients) {
                    setCustomizingProduct(uiProduct);
                } else {
                    addToCart(uiProduct, [], 1);
                }
                return;
            }

            const modifierGroups: UIModifierGroup[] = productWithModifiers?.product_modifier_groups?.map((pmg: any) => {
                const group = pmg.modifier_groups;
                return {
                    id: group.id,
                    name: group.name,
                    min_selections: group.min_selections,
                    max_selections: group.max_selections,
                    required: group.is_required,
                    options: (group.modifiers || []).map((m: any) => ({
                        id: m.id,
                        name: m.name,
                        price: Number(m.price_extra),
                        is_available: m.is_available
                    }))
                };
            }) || [];

            const hasRemovableIngredients = productIngredientsMap[product.id]?.some((pi: any) => !!pi.is_removable) || false;

            if (modifierGroups.length > 0 || hasRemovableIngredients) {
                const uiProduct: UIProduct = {
                    id: product.id,
                    name: product.name,
                    description: product.description,
                    price: Number(product.price),
                    image_url: product.image_url,
                    is_available: product.is_available ?? true,
                    modifier_groups: modifierGroups
                };
                setCustomizingProduct(uiProduct);
            } else {
                const uiProduct: UIProduct = {
                    id: product.id,
                    name: product.name,
                    description: product.description,
                    price: Number(product.price),
                    image_url: product.image_url,
                    is_available: product.is_available ?? true,
                    modifier_groups: []
                };
                addToCart(uiProduct, [], 1);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmAdd = (product: any, selectedModifiers: SelectedModifier[], totalPrice: number, removedIngredients: { id: string; name: string }[]) => {
        addToCart(product, selectedModifiers, 1, removedIngredients);
        setCustomizingProduct(null);
    };

    const handleCheckout = async () => {
        const { items, getCartTotal, clearCart, orderType } = useCartStore.getState();
        if (items.length === 0 || !restaurantId) return;

        try {
            const { data: nextNumber } = await (supabase as any).rpc('get_next_order_number', { p_restaurant_id: restaurantId });
            const { data: order, error: orderError } = await (supabase.from('orders') as any).insert({
                restaurant_id: restaurantId,
                total_amount: getCartTotal(),
                status: 'pending',
                order_number: nextNumber,
                order_type: orderType
            }).select().single();

            if (orderError) throw orderError;

            const orderItems = items.map((item) => ({
                order_id: order.id,
                product_id: item.product.id,
                quantity: item.quantity,
                unit_price: item.product.price,
                modifiers_json: item.selectedModifiers || [],
                removed_ingredients: item.removedIngredients?.length ? item.removedIngredients.map(ri => ri.id) : null,
            }));

            const { error: itemsError } = await (supabase.from('order_items') as any).insert(orderItems);
            if (itemsError) throw itemsError;

            const ticketData = {
                order_number: order.order_number,
                created_at: order.created_at,
                total_amount: order.total_amount,
                type: 'DINE_IN' as const,
                items: items.map(item => ({
                    name: item.product.name,
                    quantity: item.quantity,
                    price: item.unitPrice,
                    modifiers: [
                        ...item.selectedModifiers.flatMap(group => group.options.map(opt => ({ name: opt.name, price_extra: Number(opt.price), type: 'extra' as const }))),
                        ...(item.removedIngredients || []).map(ri => ({
                            name: ri.name,
                            type: 'removal' as const
                        }))
                    ]
                }))
            };

            setOrderToPrint(ticketData);
            clearCart();
            setIsCartOpen(false);
        } catch (error: any) {
            alert(`${t('orderError')}: ${error.message}`);
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
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80')] bg-cover bg-center opacity-40 fixed" />
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
                                {activeCategory ? categories.find(c => c.id === activeCategory)?.name : 'Menú Completo'}
                            </h2>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                <Utensils className="w-3 h-3 text-primary-500" />
                                {restaurantName || 'OrderPoint'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.replace(pathname, { locale: locale === 'es' ? 'en' : 'es' })}
                            className="p-3 bg-white rounded-2xl hover:bg-slate-50 transition-colors border border-slate-200/60 shadow-sm"
                        >
                            <Globe className="w-6 h-6 text-slate-400 hover:text-primary-500 transition-colors" />
                        </button>
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
                                <div className="group bg-white rounded-[2.5rem] p-4 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-primary-500/10 hover:-translate-y-1 transition-all duration-300 border border-slate-100 h-full flex flex-col">
                                    <div className="relative aspect-square rounded-[2rem] overflow-hidden mb-4 bg-slate-100">
                                        {product.image_url ? (
                                            <img
                                                src={product.image_url}
                                                alt={product.name}
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                <Utensils className="w-12 h-12" />
                                            </div>
                                        )}
                                        {!product.is_available && (
                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                                                <span className="bg-red-500 text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest">Agotado</span>
                                            </div>
                                        )}
                                        <button
                                            onClick={() => handleAddToCart(product)}
                                            disabled={!product.is_available}
                                            className="absolute bottom-4 right-4 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg text-slate-900 group-hover:bg-primary-500 group-hover:text-white transition-all disabled:opacity-0 disabled:pointer-events-none transform translate-y-20 group-hover:translate-y-0 duration-300"
                                        >
                                            <span className="font-bold text-xl">+</span>
                                        </button>
                                    </div>
                                    <div className="flex-1 flex flex-col">
                                        <h3 className="text-xl font-black text-slate-900 leading-tight mb-2 line-clamp-2 uppercase italic tracking-tight group-hover:text-primary-500 transition-colors">
                                            {product.name}
                                        </h3>
                                        <p className="text-sm text-slate-500 font-medium leading-relaxed mb-4 line-clamp-2 flex-1">
                                            {product.description}
                                        </p>
                                        <div className="flex items-end justify-between mt-auto pt-4 border-t border-slate-50">
                                            <span className="text-2xl font-black text-slate-900 tracking-tight">
                                                ${Number(product.price).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {filteredProducts.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400 animate-in fade-in">
                            <Search className="w-16 h-16 mb-4 opacity-50" />
                            <p className="font-bold uppercase tracking-widest">No hay productos disponibles</p>
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
                        <h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Mi Orden</h3>
                        <p className="text-slate-500 text-sm font-bold mt-1">Revisa tus productos</p>
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
                    <ProductCustomizationModal
                        open={!!customizingProduct}
                        product={customizingProduct}
                        onClose={() => setCustomizingProduct(null)}
                        onAdd={handleConfirmAdd}
                        locale={locale}
                    />
                )
            }

            <div className="hidden">
                {orderToPrint && <OrderTicket ref={ticketRef} order={orderToPrint} />}
            </div>
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
