'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { adminSupabase } from '@/lib/supabase/admin-client';
import { useRouter } from '@/i18n/routing';
import {
    LayoutDashboard,
    ShoppingBag,
    Users,
    LogOut,
    Package,
    List,
    Plus,
    Trash2,
    Pencil,
    X as CloseIcon,
    Image as ImageIcon,
    Search,
    ChefHat
} from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { SidebarLink } from '@/components/admin/SidebarLink';

import { useAuth } from '@/components/auth/AuthContext';

import imageCompression from 'browser-image-compression';

export default function ProductsPage() {
    const t = useTranslations('admin');
    const router = useRouter();
    const { restaurantId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [allIngredients, setAllIngredients] = useState<any[]>([]);
    const [selectedIngredients, setSelectedIngredients] = useState<{ ingredient_id: string, is_removable: boolean }[]>([]);

    const [newProduct, setNewProduct] = useState({
        name: '',
        description: '',
        price: '',
        category_id: '',
        image_url: '',
        is_available: true
    });

    useEffect(() => {
        if (restaurantId) {
            loadData();
        }
    }, [restaurantId]);

    const loadData = async () => {
        if (!restaurantId) return;
        setLoading(true);
        const [productsRes, categoriesRes, ingredientsRes] = await Promise.all([
            adminSupabase.from('products')
                .select('*, categories(name)')
                .eq('restaurant_id', restaurantId)
                .order('created_at', { ascending: false }),
            adminSupabase.from('categories')
                .select('*')
                .eq('restaurant_id', restaurantId)
                .order('name', { ascending: true }),
            adminSupabase.from('ingredients')
                .select('*')
                .eq('restaurant_id', restaurantId)
                .order('name', { ascending: true })
        ]);

        if (productsRes.data) setProducts(productsRes.data);
        if (ingredientsRes.data) setAllIngredients(ingredientsRes.data);
        if (categoriesRes.data) {
            const cats = categoriesRes.data as any[];
            setCategories(cats);
            if (cats.length > 0 && !editingProduct) {
                setNewProduct(prev => ({ ...prev, category_id: cats[0].id }));
            }
        }
        setLoading(false);
    };

    const resetForm = () => {
        setNewProduct({
            name: '',
            description: '',
            price: '',
            category_id: categories[0]?.id || '',
            image_url: '',
            is_available: true
        });
        setSelectedIngredients([]);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingImage(true);
        try {
            // Options for compression
            const options = {
                maxSizeMB: 0.2, // 200KB
                maxWidthOrHeight: 1024,
                useWebWorker: true,
            };

            const compressedFile = await imageCompression(file, options);

            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
            const filePath = `products/${fileName}`;

            const { error: uploadError } = await adminSupabase.storage
                .from('products')
                .upload(filePath, compressedFile);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = adminSupabase.storage
                .from('products')
                .getPublicUrl(filePath);

            setNewProduct(prev => ({ ...prev, image_url: publicUrl }));
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Error al subir la imagen. Asegúrate de que el bucket "products" exista y sea público.');
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSaveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!restaurantId) return;
        setSaving(true);

        try {
            if (editingProduct) {
                const { error } = await (adminSupabase.from('products') as any)
                    .update({
                        name: newProduct.name,
                        description: newProduct.description || null,
                        price: parseFloat(newProduct.price),
                        category_id: newProduct.category_id || null,
                        image_url: newProduct.image_url || null,
                        is_available: newProduct.is_available
                    })
                    .eq('id', editingProduct.id);

                if (!error) {
                    // Update ingredients
                    await adminSupabase.from('product_ingredients').delete().eq('product_id', editingProduct.id);
                    if (selectedIngredients.length > 0) {
                        await (adminSupabase.from('product_ingredients') as any).insert(
                            selectedIngredients.map(si => ({
                                product_id: editingProduct.id,
                                ingredient_id: si.ingredient_id,
                                is_removable: si.is_removable
                            }))
                        );
                    }

                    setIsModalOpen(false);
                    setEditingProduct(null);
                    resetForm();
                    loadData();
                }
            } else {
                const { data: product, error } = await (adminSupabase.from('products') as any).insert({
                    name: newProduct.name,
                    description: newProduct.description || null,
                    price: parseFloat(newProduct.price),
                    category_id: newProduct.category_id || null,
                    image_url: newProduct.image_url || null,
                    restaurant_id: restaurantId,
                    is_available: newProduct.is_available
                }).select().single();

                if (!error && product) {
                    // Save ingredients
                    if (selectedIngredients.length > 0) {
                        await (adminSupabase.from('product_ingredients') as any).insert(
                            selectedIngredients.map(si => ({
                                product_id: product.id,
                                ingredient_id: si.ingredient_id,
                                is_removable: si.is_removable
                            }))
                        );
                    }

                    setIsModalOpen(false);
                    resetForm();
                    loadData();
                } else {
                    console.error('Error adding product:', error);
                }
            }
        } catch (err) {
            console.error('Error saving product:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleEditClick = async (product: any) => {
        setEditingProduct(product);
        setNewProduct({
            name: product.name,
            description: product.description || '',
            price: product.price.toString(),
            category_id: product.category_id,
            image_url: product.image_url || '',
            is_available: product.is_available
        });

        // Load product ingredients
        const { data } = await (adminSupabase.from('product_ingredients') as any)
            .select('ingredient_id, is_removable')
            .eq('product_id', product.id);

        if (data) {
            setSelectedIngredients(data.map((d: any) => ({
                ingredient_id: d.ingredient_id,
                is_removable: d.is_removable
            })));
        } else {
            setSelectedIngredients([]);
        }

        setIsModalOpen(true);
    };

    const handleDeleteProduct = async (id: string) => {
        if (confirm('¿Estás seguro de eliminar este producto?')) {
            const { error } = await adminSupabase.from('products').delete().eq('id', id);
            if (!error) loadData();
        }
    };

    const handleToggleAvailability = async (id: string, currentStatus: boolean) => {
        const { error } = await (adminSupabase.from('products') as any)
            .update({ is_available: !currentStatus })
            .eq('id', id);

        if (!error) {
            setProducts(prev => prev.map(p => p.id === id ? { ...p, is_available: !currentStatus } : p));
        }
    };

    const handleLogout = async () => {
        await adminSupabase.auth.signOut();
        router.push('/login');
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.categories?.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-background">
            {/* Sidebar */}
            <aside className="w-72 bg-white border-r border-secondary-100 hidden lg:flex flex-col sticky top-0 h-screen">
                <div className="p-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-500 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-200">
                            <span className="text-white font-black text-xl">O</span>
                        </div>
                        <span className="text-2xl font-black text-secondary-900 tracking-tighter">OrderPoint</span>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    <SidebarLink
                        icon={<LayoutDashboard className="w-5 h-5" />}
                        label={t('dashboard')}
                        onClick={() => router.push('/admin/dashboard')}
                    />
                    <SidebarLink
                        icon={<ShoppingBag className="w-5 h-5" />}
                        label={t('orders')}
                    />
                    <SidebarLink
                        icon={<Package className="w-5 h-5" />}
                        label={t('products')}
                        active
                    />
                    <SidebarLink
                        icon={<List className="w-5 h-5" />}
                        label={t('categories')}
                        onClick={() => router.push('/admin/categories')}
                    />
                    <SidebarLink
                        icon={<ChefHat className="w-5 h-5" />}
                        label="Ingredientes"
                        onClick={() => router.push('/admin/ingredients')}
                    />
                </nav>

                <div className="p-6 mt-auto">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-6 py-4 text-secondary-500 hover:bg-red-50 hover:text-red-600 rounded-[2rem] transition-all duration-300 font-bold group"
                    >
                        <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span>Cerrar Sesión</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 md:p-10 overflow-y-auto">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10 animate-slide-up">
                    <div>
                        <h1 className="text-4xl font-black text-secondary-900 tracking-tight">{t('products')}</h1>
                        <p className="text-secondary-500 font-bold mt-1">Administra los platillos y bebidas de tu menú.</p>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                            <input
                                type="text"
                                placeholder="Buscar producto..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-14 pr-6 py-4 bg-white border border-secondary-100 rounded-[1.5rem] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-bold shadow-sm"
                            />
                        </div>
                        <button
                            onClick={() => {
                                setEditingProduct(null);
                                resetForm();
                                setIsModalOpen(true);
                            }}
                            className="flex items-center gap-3 bg-primary-500 text-white px-8 py-4 rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-primary-500/20 hover:-translate-y-1 transition-all active:scale-95 whitespace-nowrap"
                        >
                            <Plus className="w-5 h-5" />
                            <span>Nuevo Producto</span>
                        </button>
                    </div>
                </header>

                <div className="bg-white rounded-[2.5rem] shadow-xl shadow-secondary-900/5 border border-secondary-100 overflow-hidden animate-slide-up">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-secondary-50/50 text-secondary-400 text-xs uppercase font-black tracking-widest">
                                <tr>
                                    <th className="px-8 py-5">Producto</th>
                                    <th className="px-8 py-5">Categoría</th>
                                    <th className="px-8 py-5">Precio</th>
                                    <th className="px-8 py-5">Estado</th>
                                    <th className="px-8 py-5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-secondary-50">
                                {filteredProducts.map((product) => (
                                    <tr key={product.id} className="hover:bg-secondary-50/30 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-secondary-50 flex items-center justify-center overflow-hidden border border-secondary-100">
                                                    {product.image_url ? (
                                                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Package className="w-6 h-6 text-secondary-200" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-black text-secondary-900">{product.name}</p>
                                                    <p className="text-xs text-secondary-400 font-bold line-clamp-1">{product.description}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="px-4 py-1.5 bg-secondary-100 text-secondary-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                                                {product.categories?.name}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 font-black text-secondary-900">
                                            {formatPrice(product.price, 'es-SV')}
                                        </td>
                                        <td className="px-8 py-6">
                                            <button
                                                onClick={() => handleToggleAvailability(product.id, product.is_available)}
                                                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95 ${product.is_available
                                                    ? 'bg-accent-100 text-accent-700 hover:bg-accent-200'
                                                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                                                    }`}
                                            >
                                                <div className={`w-2 h-2 rounded-full ${product.is_available ? 'bg-accent-500' : 'bg-red-500'}`} />
                                                {product.is_available ? 'Disponible' : 'Agotado'}
                                            </button>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleEditClick(product)}
                                                    className="p-3 text-secondary-300 hover:text-primary-600 hover:bg-primary-50 rounded-2xl transition-all"
                                                >
                                                    <Pencil className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteProduct(product.id)}
                                                    className="p-3 text-secondary-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Add/Edit Product Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-secondary-900/60 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto">
                        <div className="bg-white w-full max-w-2xl rounded-[2rem] sm:rounded-[3rem] shadow-2xl overflow-hidden animate-scale-in my-auto max-h-[95vh] flex flex-col">
                            <div className="p-6 sm:p-8 border-b border-secondary-50 flex justify-between items-center bg-secondary-50/30 flex-shrink-0">
                                <h2 className="text-xl sm:text-2xl font-black text-secondary-900 tracking-tight">
                                    {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                                </h2>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-2 sm:p-3 hover:bg-white rounded-xl sm:rounded-2xl transition-all shadow-sm border border-secondary-100"
                                >
                                    <CloseIcon className="w-5 sm:w-6 h-5 sm:h-6 text-secondary-400" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveProduct} className="p-6 sm:p-8 overflow-y-auto custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] sm:text-xs font-black text-secondary-400 uppercase tracking-widest mb-2 px-2">Nombre del Producto</label>
                                        <input
                                            type="text"
                                            required
                                            value={newProduct.name}
                                            onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                            className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-secondary-50 border border-secondary-100 rounded-xl sm:rounded-[1.5rem] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-bold"
                                            placeholder="Ej: Hamburguesa con Queso"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] sm:text-xs font-black text-secondary-400 uppercase tracking-widest mb-2 px-2">Descripción</label>
                                        <textarea
                                            rows={2}
                                            value={newProduct.description}
                                            onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                                            className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-secondary-50 border border-secondary-100 rounded-xl sm:rounded-[1.5rem] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-bold resize-none"
                                            placeholder="Describe los ingredientes..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] sm:text-xs font-black text-secondary-400 uppercase tracking-widest mb-2 px-2">Precio ($)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            value={newProduct.price}
                                            onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                                            className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-secondary-50 border border-secondary-100 rounded-xl sm:rounded-[1.5rem] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-bold"
                                            placeholder="9.99"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] sm:text-xs font-black text-secondary-400 uppercase tracking-widest mb-2 px-2">Categoría</label>
                                        <select
                                            required
                                            value={newProduct.category_id}
                                            onChange={(e) => setNewProduct({ ...newProduct, category_id: e.target.value })}
                                            className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-secondary-50 border border-secondary-100 rounded-xl sm:rounded-[1.5rem] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-bold appearance-none"
                                        >
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] sm:text-xs font-black text-secondary-400 uppercase tracking-widest mb-2 px-2">Imagen del Producto</label>
                                        <div className="flex flex-col gap-4">
                                            {newProduct.image_url ? (
                                                <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-secondary-100 group">
                                                    <img src={newProduct.image_url} alt="Preview" className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => setNewProduct({ ...newProduct, image_url: '' })}
                                                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <label className="w-full aspect-video rounded-2xl border-2 border-dashed border-secondary-200 flex flex-col items-center justify-center gap-3 hover:border-primary-500 hover:bg-primary-50/30 transition-all cursor-pointer">
                                                    <div className="w-12 h-12 rounded-2xl bg-secondary-50 flex items-center justify-center text-secondary-400">
                                                        {uploadingImage ? (
                                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                                                        ) : (
                                                            <ImageIcon className="w-6 h-6" />
                                                        )}
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-sm font-black text-secondary-900">
                                                            {uploadingImage ? 'Subiendo...' : 'Subir Imagen'}
                                                        </p>
                                                        <p className="text-[10px] text-secondary-400 font-bold uppercase tracking-widest">
                                                            PNG, JPG o WEBP (Máx. 200KB)
                                                        </p>
                                                    </div>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleImageUpload}
                                                        className="hidden"
                                                        disabled={uploadingImage}
                                                    />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                    <div className="md:col-span-2 flex items-center gap-3 px-2">
                                        <input
                                            type="checkbox"
                                            id="is_available"
                                            checked={newProduct.is_available}
                                            onChange={(e) => setNewProduct({ ...newProduct, is_available: e.target.checked })}
                                            className="w-5 h-5 rounded border-secondary-100 text-primary-500 focus:ring-primary-500"
                                        />
                                        <label htmlFor="is_available" className="text-sm font-black text-secondary-900 uppercase tracking-widest">Disponible para la venta</label>
                                    </div>

                                    <div className="md:col-span-2 border-t border-secondary-50 pt-6">
                                        <label className="block text-[10px] sm:text-xs font-black text-secondary-400 uppercase tracking-widest mb-4 px-2">Ingredientes del Plato</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {allIngredients.map(ingredient => {
                                                const isSelected = selectedIngredients.some(si => si.ingredient_id === ingredient.id);
                                                const selectedData = selectedIngredients.find(si => si.ingredient_id === ingredient.id);

                                                return (
                                                    <div
                                                        key={ingredient.id}
                                                        className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all flex flex-col gap-2 sm:gap-3 ${isSelected ? 'bg-primary-50 border-primary-200' : 'bg-secondary-50/50 border-secondary-100'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedIngredients([...selectedIngredients, { ingredient_id: ingredient.id, is_removable: true }]);
                                                                    } else {
                                                                        setSelectedIngredients(selectedIngredients.filter(si => si.ingredient_id !== ingredient.id));
                                                                    }
                                                                }}
                                                                className="w-5 h-5 rounded border-secondary-200 text-primary-500 focus:ring-primary-500"
                                                            />
                                                            <span className={`font-bold text-sm ${isSelected ? 'text-primary-900' : 'text-secondary-600'}`}>
                                                                {ingredient.name}
                                                            </span>
                                                        </div>

                                                        {isSelected && (
                                                            <div className="flex items-center gap-2 pl-8">
                                                                <input
                                                                    type="checkbox"
                                                                    id={`removable-${ingredient.id}`}
                                                                    checked={selectedData?.is_removable}
                                                                    onChange={(e) => {
                                                                        setSelectedIngredients(selectedIngredients.map(si =>
                                                                            si.ingredient_id === ingredient.id
                                                                                ? { ...si, is_removable: e.target.checked }
                                                                                : si
                                                                        ));
                                                                    }}
                                                                    className="w-4 h-4 rounded border-secondary-200 text-primary-500 focus:ring-primary-500"
                                                                />
                                                                <label htmlFor={`removable-${ingredient.id}`} className="text-[9px] sm:text-[10px] font-black uppercase text-primary-600 tracking-wider">
                                                                    Cliente puede quitarlo
                                                                </label>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {allIngredients.length === 0 && (
                                            <p className="text-xs text-secondary-400 italic px-2">No hay ingredientes creados. Ve a la sección de Ingredientes para añadir algunos.</p>
                                        )}
                                    </div>

                                    <div className="md:col-span-2 pt-4">
                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="w-full py-4 sm:py-5 bg-primary-500 text-white rounded-xl sm:rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-primary-500/20 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0"
                                        >
                                            {saving ? 'Guardando...' : (editingProduct ? 'Guardar Cambios' : 'Crear Producto')}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
