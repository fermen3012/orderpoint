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
import { CategorySidebar } from '@/components/kiosk/CategorySidebar';
import { useReactToPrint } from 'react-to-print';
import { getModifiersByProduct } from '@/actions/modifiers';
import { Globe, ShoppingBag, ArrowLeft } from 'lucide-react';
import { useRouter, usePathname } from '@/i18n/routing';
import type { Database } from '@/lib/supabase/types';
import { useAuth } from '@/components/auth/AuthContext';
import { cn } from '@/lib/utils';
import { Product as UIProduct, ModifierGroup as UIModifierGroup, Modifier as UIModifier, SelectedModifier } from '@/types';

type DBProduct = Database['public']['Tables']['products']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

export default function KioskPage({ params }: { params: Promise<{ locale: string }> }) {
    const resolvedParams = use(params);
    const locale = resolvedParams.locale;
    const t = useTranslations('kiosk');
    const router = useRouter();
    const pathname = usePathname();

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
                    console.log(`Loaded ${productsRes.data.length} products`);

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
                            console.log(`Loaded ${ingredientsData.length} total ingredients associations`);
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

                // Even if modifier fetch fails, check for removable ingredients
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

            // Map DB structure to UI Interface
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

            // Check if product has removable ingredients
            // We can look this up in the map we already loaded
            const hasRemovableIngredients = productIngredientsMap[product.id]?.some((pi: any) => !!pi.is_removable) || false;

            console.log('Product:', product.name, 'Modifiers:', modifierGroups.length, 'Removable:', hasRemovableIngredients, 'Ingredients:', productIngredientsMap[product.id]);

            if (modifierGroups.length > 0 || hasRemovableIngredients) {
                // Convert DBProduct to UIProduct
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
                // No modifiers, just add directly
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
        // Price is recalculated in store for safety/consistency, but we trust logic here.
        // We just pass product + modifiers.
        addToCart(product, selectedModifiers, 1, removedIngredients);
        setCustomizingProduct(null);
    };

    const handleCheckout = async () => {
        const { items, getCartTotal, clearCart } = useCartStore.getState();
        if (items.length === 0 || !restaurantId) return;

        try {
            const { data: nextNumber } = await (supabase as any).rpc('get_next_order_number', { p_restaurant_id: restaurantId });
            const { data: order, error: orderError } = await (supabase.from('orders') as any).insert({
                restaurant_id: restaurantId,
                total_amount: getCartTotal(),
                status: 'pending',
                order_number: nextNumber
            }).select().single();

            if (orderError) throw orderError;

            const orderItems = items.map((item) => ({
                order_id: order.id,
                product_id: item.product.id,
                quantity: item.quantity,
                unit_price: item.product.price, // Base price, modifiers stored in JSON
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
            <div className="h-screen w-screen flex items-center justify-center bg-white">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen overflow-hidden flex flex-col md:flex-row bg-gradient-to-b from-green-50 to-white">
            {/* LEFT PANEL: CATEGORIES */}
            <CategorySidebar
                categories={categories}
                activeCategory={activeCategory}
                onSelect={setActiveCategory}
            />

            {/* RIGHT PANEL: PRODUCTS */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Sticky Header */}
                <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-green-100 flex items-center justify-between px-8 py-6">
                    <div className="flex flex-col">
                        <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic">
                            {activeCategory ? categories.find(c => c.id === activeCategory)?.name : 'Menú Completo'}
                        </h2>
                        <span className="text-xs font-bold text-green-600 uppercase tracking-widest">
                            {restaurantName || 'OrderPoint'}
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.replace(pathname, { locale: locale === 'es' ? 'en' : 'es' })}
                            className="p-3 bg-green-50 rounded-2xl hover:bg-green-100 transition-colors"
                        >
                            <Globe className="w-6 h-6 text-green-600" />
                        </button>
                        <button
                            onClick={() => setIsCartOpen(!isCartOpen)}
                            className="relative p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl text-white shadow-lg shadow-green-500/20 active:scale-95 transition-all"
                        >
                            <ShoppingBag className="w-6 h-6" />
                            <CartCounter />
                        </button>
                    </div>
                </header>

                {/* Product Grid */}
                <div className="flex-1 overflow-y-auto px-8 py-8 scrollbar-hide">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredProducts.map((product, idx) => (
                            <div key={product.id} className="animate-in fade-in slide-in-from-bottom-5 duration-500" style={{ animationDelay: `${idx * 50}ms` }}>
                                <ProductCard
                                    id={product.id}
                                    name={product.name}
                                    description={product.description}
                                    price={Number(product.price)}
                                    imageUrl={product.image_url}
                                    isAvailable={product.is_available}
                                    onAddToCart={() => handleAddToCart(product)}
                                    locale={locale}
                                />
                            </div>
                        ))}
                    </div>
                    {/* Spacer for bottom */}
                    <div className="h-32" />
                    <CartFloatingBar onOpenCart={() => setIsCartOpen(true)} />
                </div>
            </main>

            {/* CART SIDE PANEL */}
            <div className={cn(
                "fixed inset-y-0 right-0 w-full sm:w-96 bg-white z-50 transform transition-transform duration-500 ease-spring shadow-[-20px_0_60px_rgba(0,0,0,0.1)] flex flex-col",
                isCartOpen ? "translate-x-0" : "translate-x-full"
            )}>
                <div className="p-6 border-b border-secondary-100 flex items-center justify-between">
                    <h3 className="text-2xl font-black text-secondary-900 tracking-tighter uppercase italic">Mi Carrito</h3>
                    <button
                        onClick={() => setIsCartOpen(false)}
                        className="p-2 bg-secondary-100 rounded-xl hover:bg-secondary-200"
                    >
                        <ArrowLeft className="w-6 h-6 rotate-180" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <Cart locale={locale} onCheckout={handleCheckout} />
                </div>
            </div>

            {/* Customization Modal */}
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

            {/* Hidden Ticket for Printing */}
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
        <span className="absolute -top-1 -right-1 w-6 h-6 bg-secondary-900 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-md animate-bounce">
            {count}
        </span>
    );
}
