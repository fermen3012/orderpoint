'use client';

import { use, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase/client';
import { formatPrice, formatOrderNumber } from '@/lib/utils';
import { useCartStore } from '@/store/cart-store';
import { ProductCard } from '@/components/kiosk/ProductCard';
import { CategoryCard } from '@/components/kiosk/CategoryCard';
import { Cart } from '@/components/kiosk/Cart';
import { ProductCustomizationModal } from '@/components/kiosk/ProductCustomizationModal';
import { Globe, ArrowLeft } from 'lucide-react';
import { useRouter, usePathname } from '@/i18n/routing';
import type { Database } from '@/lib/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];


import { useAuth } from '@/components/auth/AuthContext';

export default function KioskPage({ params }: { params: Promise<{ locale: string }> }) {
    const resolvedParams = use(params);
    const locale = resolvedParams.locale;
    const t = useTranslations('kiosk');
    const router = useRouter();
    const pathname = usePathname();

    const { restaurantId } = useAuth();
    const { addItem } = useCartStore();

    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [productIngredientsMap, setProductIngredientsMap] = useState<Record<string, any[]>>({});
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);

    // Load categories and products
    useEffect(() => {
        async function loadData() {
            if (!restaurantId) return;

            setLoading(true);

            try {
                const [categoriesRes, productsRes, ingredientsRes] = await Promise.all([
                    supabase
                        .from('categories')
                        .select('*')
                        .eq('restaurant_id', restaurantId)
                        .order('sort_order'),
                    supabase
                        .from('products')
                        .select('*')
                        .eq('restaurant_id', restaurantId)
                        .eq('is_available', true),
                    supabase
                        .from('product_ingredients')
                        .select('*, ingredients(name)')
                ]);

                if (categoriesRes.data) setCategories(categoriesRes.data);
                if (productsRes.data) setProducts(productsRes.data);

                if (ingredientsRes.data) {
                    const map: Record<string, any[]> = {};
                    ingredientsRes.data.forEach((pi: any) => {
                        if (!map[pi.product_id]) map[pi.product_id] = [];
                        map[pi.product_id].push(pi);
                    });
                    setProductIngredientsMap(map);
                }
            } catch (error) {
                console.error('Error loading kiosk data:', error);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [restaurantId]);

    const handleAddToCart = (product: Product) => {
        const ingredients = productIngredientsMap[product.id] || [];

        if (ingredients.length > 0) {
            setCustomizingProduct(product);
        } else {
            addItem({
                productId: product.id,
                productName: product.name,
                productPrice: Number(product.price),
                productImage: product.image_url,
                quantity: 1,
                modifiers: [],
                removedIngredients: [],
                totalPrice: Number(product.price),
            });
        }
    };

    const handleConfirmCustomization = (removedIngredientIds: string[]) => {
        if (!customizingProduct) return;

        addItem({
            productId: customizingProduct.id,
            productName: customizingProduct.name,
            productPrice: Number(customizingProduct.price),
            productImage: customizingProduct.image_url,
            quantity: 1,
            modifiers: [],
            removedIngredients: removedIngredientIds,
            totalPrice: Number(customizingProduct.price),
        });

        setCustomizingProduct(null);
    };

    const handleCheckout = async () => {
        const { items, getTotal, clearCart } = useCartStore.getState();

        if (items.length === 0 || !restaurantId) return;

        try {
            console.log('--- CHECKOUT START ---');
            console.log('Restaurant ID:', restaurantId);
            console.log('Cart Items:', items);

            // Create order
            const orderData = {
                restaurant_id: restaurantId,
                total_amount: getTotal(),
                status: 'pending' as const,
            };
            console.log('Inserting Order:', orderData);

            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert(orderData as any)
                .select()
                .single() as any;

            if (orderError) {
                console.error('Supabase Order Error Object:', JSON.stringify(orderError, null, 2));
                throw new Error(`Order Creation Failed: ${orderError.message || orderError.details || JSON.stringify(orderError)} `);
            }

            console.log('Order Created Successfully:', order);

            // Create order items
            const orderItems = items.map((item) => ({
                order_id: order.id,
                product_id: item.productId,
                quantity: item.quantity,
                unit_price: item.productPrice,
                modifiers_json: item.modifiers || [],
                removed_ingredients: item.removedIngredients && item.removedIngredients.length > 0
                    ? item.removedIngredients
                    : null,
            }));
            console.log('Inserting Order Items:', JSON.stringify(orderItems, null, 2));

            const { error: itemsError } = await (supabase.from('order_items') as any).insert(orderItems);

            if (itemsError) {
                console.error('Supabase Items Error Object:', JSON.stringify(itemsError, null, 2));
                throw new Error(`Order Items Creation Failed: ${itemsError.message || itemsError.details || JSON.stringify(itemsError)} `);
            }

            console.log('Order Items Created Successfully');
            console.log('--- CHECKOUT SUCCESS ---');

            // Clear cart and show success
            clearCart();
            alert(`${t('orderPlaced')} ${t('orderNumber')}: #${order.order_number} `);
        } catch (error: any) {
            console.error('--- CHECKOUT FAILED ---');
            console.error('Full Error Object:', JSON.stringify(error, null, 2));
            alert(`${t('orderError')}: ${error.message || JSON.stringify(error)} `);
        }
    };

    const toggleLocale = () => {
        const newLocale = locale === 'es' ? 'en' : 'es';
        router.replace(pathname, { locale: newLocale });
    };

    const filteredProducts = selectedCategory
        ? products.filter((p) => p.category_id === selectedCategory)
        : products;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto mb-4"></div>
                    <p className="text-gray-600 text-lg">{t('loading') || 'Cargando...'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-12">
            {/* Header Section */}
            <header className="relative bg-white rounded-b-[2rem] sm:rounded-b-[3rem] shadow-sm border-b border-secondary-100/50 px-4 sm:px-6 pt-6 sm:pt-8 pb-8 sm:pb-12 mb-6 sm:mb-8 overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-50 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-50" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent-50 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl opacity-30" />

                <div className="max-w-7xl mx-auto relative">
                    <div className="flex items-center justify-between mb-6 sm:mb-8">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-primary-200">
                                <span className="text-white font-black text-lg sm:text-xl">O</span>
                            </div>
                            <span className="text-xl sm:text-2xl font-black text-secondary-900 tracking-tighter">OrderPoint</span>
                        </div>

                        <button
                            onClick={toggleLocale}
                            className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-secondary-50 border border-secondary-100 rounded-xl sm:rounded-2xl hover:bg-white hover:shadow-md transition-all duration-300 touch-target group"
                        >
                            <Globe className="w-4 sm:w-5 h-4 sm:h-5 text-secondary-600 group-hover:rotate-12 transition-transform" />
                            <span className="font-black text-secondary-900 text-xs sm:text-sm">{locale.toUpperCase()}</span>
                        </button>
                    </div>

                    <div className="animate-slide-up">
                        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-secondary-900 mb-2 sm:mb-3 tracking-tight leading-none">
                            {t('welcome')}
                        </h1>
                        <p className="text-secondary-500 text-base sm:text-lg font-bold max-w-lg">
                            {selectedCategory
                                ? categories.find(c => c.id === selectedCategory)?.name
                                : t('freshMessage')}
                        </p>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-10">
                {/* Main Content */}
                <div className="lg:col-span-2">
                    {/* Navigation/Back Button */}
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-black text-secondary-900 tracking-tight">
                            {selectedCategory ? t('products') : t('categories')}
                        </h2>

                        {selectedCategory && (
                            <button
                                onClick={() => setSelectedCategory(null)}
                                className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl shadow-sm border border-secondary-100 hover:shadow-md hover:-translate-x-1 transition-all touch-target group"
                            >
                                <ArrowLeft className="w-5 h-5 text-primary-600 group-hover:-translate-x-1 transition-transform" />
                                <span className="font-bold text-secondary-900">{t('back')}</span>
                            </button>
                        )}
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        {!selectedCategory ? (
                            categories.map((category, idx) => (
                                <div key={category.id} style={{ animationDelay: `${idx * 100} ms` }}>
                                    <CategoryCard
                                        id={category.id}
                                        name={category.name}
                                        imageUrl={category.image_url}
                                        productCount={products.filter((p) => p.category_id === category.id).length}
                                        onClick={() => setSelectedCategory(category.id)}
                                    />
                                </div>
                            ))
                        ) : (
                            filteredProducts.map((product, idx) => (
                                <div key={product.id} style={{ animationDelay: `${idx * 100} ms` }}>
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
                            ))
                        )}
                    </div>
                </div>

                {/* Cart Sidebar */}
                <div className="lg:col-span-1">
                    <Cart locale={locale} onCheckout={handleCheckout} />
                </div>
            </div>

            {/* Customization Modal */}
            {customizingProduct && (
                <ProductCustomizationModal
                    product={customizingProduct}
                    ingredients={productIngredientsMap[customizingProduct.id] || []}
                    onClose={() => setCustomizingProduct(null)}
                    onConfirm={handleConfirmCustomization}
                    locale={locale}
                />
            )}
        </div>
    );
}
