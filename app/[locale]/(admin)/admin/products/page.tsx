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
    ChefHat,
    Loader2
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
        <div className="p-4 md:p-8 lg:p-10">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-secondary-900 tracking-tight">{t('products')}</h1>
                    <p className="text-secondary-500 font-bold mt-1 text-sm md:text-base">Gestiona el menú de tu restaurante.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingProduct(null); // Ensure editingProduct is reset
                        resetForm();
                        setIsModalOpen(true);
                    }}
                    className="w-full md:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-primary-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary-500/20 hover:-translate-y-1 transition-all active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    <span>Añadir Producto</span>
                </button>
            </header>

            {/* Search and Filters */}
            <div className="mb-10 animate-slide-up">
                <div className="relative group max-w-2xl">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400 group-focus-within:text-primary-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o categoría..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-16 pr-8 py-5 bg-white border border-secondary-100 rounded-[2rem] shadow-sm focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold text-secondary-900"
                    />
                </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 md:gap-8 animate-slide-up" style={{ animationDelay: '100ms' }}>
                {filteredProducts.map((product) => (
                    <div key={product.id} className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-xl shadow-secondary-900/5 border border-secondary-100 overflow-hidden group hover:-translate-y-2 transition-all duration-500">
                        {/* Status Badge */}
                        <div className="absolute top-4 right-4 z-10">
                            <button
                                onClick={() => handleToggleAvailability(product.id, product.is_available)}
                                className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg ${product.is_available
                                    ? 'bg-accent-500 text-white'
                                    : 'bg-red-500 text-white'
                                    }`}
                            >
                                {product.is_available ? 'Disponible' : 'No Disp.'}
                            </button>
                        </div>

                        <div className="aspect-square bg-secondary-50 relative overflow-hidden">
                            {product.image_url ? (
                                <img
                                    src={product.image_url}
                                    alt={product.name}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Package className="w-12 h-12 text-secondary-200" />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-secondary-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-8">
                                <div className="flex gap-3 w-full">
                                    <button
                                        onClick={() => handleEditClick(product)}
                                        className="flex-1 bg-white text-secondary-900 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary-500 hover:text-white transition-all shadow-xl"
                                    >
                                        Editar
                                    </button>
                                    <button
                                        onClick={() => handleDeleteProduct(product.id)}
                                        className="p-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all shadow-xl"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 md:p-8">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl md:text-2xl font-black text-secondary-900 tracking-tight line-clamp-1">{product.name}</h3>
                                    <span className="text-[10px] md:text-xs font-black text-primary-500 uppercase tracking-widest bg-primary-50 px-3 py-1 rounded-full border border-primary-100 mt-2 inline-block">
                                        {product.categories?.name}
                                    </span>
                                </div>
                                <span className="text-xl md:text-2xl font-black text-secondary-900">{formatPrice(product.price, 'es-SV')}</span>
                            </div>
                            <p className="text-secondary-500 font-bold text-sm line-clamp-2 min-h-[3rem]">
                                {product.description || 'Sin descripción disponible.'}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Empty State */}
            {filteredProducts.length === 0 && (
                <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-secondary-100">
                    <div className="w-20 h-20 bg-secondary-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Package className="w-10 h-10 text-secondary-200" />
                    </div>
                    <h3 className="text-2xl font-black text-secondary-900 tracking-tight">No se encontraron productos</h3>
                    <p className="text-secondary-500 font-bold mt-2">Prueba con otra búsqueda o añade un nuevo producto.</p>
                </div>
            )}

            {/* Product Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-secondary-900/60 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto">
                    <div className="bg-white w-full max-w-4xl rounded-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden animate-scale-in my-8">
                        <div className="p-6 md:p-10 border-b border-secondary-50 flex justify-between items-center bg-secondary-50/30">
                            <div>
                                <h2 className="text-2xl md:text-3xl font-black text-secondary-900 tracking-tight">
                                    {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                                </h2>
                                <p className="text-secondary-500 font-bold mt-1 text-sm">Completa la información del producto.</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 md:p-3 hover:bg-white rounded-xl md:rounded-2xl transition-all shadow-sm border border-secondary-100"
                            >
                                <CloseIcon className="w-5 h-5 md:w-6 md:h-6 text-secondary-400" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveProduct} className="p-6 md:p-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                                {/* Image Upload */}
                                <div className="space-y-4">
                                    <label className="block text-xs font-black text-secondary-400 uppercase tracking-widest px-2">Imagen del Producto</label>
                                    <div className="relative aspect-square rounded-[2rem] overflow-hidden bg-secondary-50 border-2 border-dashed border-secondary-200 group transition-all hover:border-primary-500">
                                        {newProduct.image_url ? (
                                            <>
                                                <img src={newProduct.image_url} alt="Preview" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-secondary-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                                    <label className="cursor-pointer bg-white text-secondary-900 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary-500 hover:text-white transition-all shadow-xl">
                                                        Cambiar Imagen
                                                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
                                                    </label>
                                                </div>
                                            </>
                                        ) : (
                                            <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-white transition-colors">
                                                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4">
                                                    {uploadingImage ? <Loader2 className="w-8 h-8 text-primary-500 animate-spin" /> : <ImageIcon className="w-8 h-8 text-secondary-200" />}
                                                </div>
                                                <span className="text-sm font-black text-secondary-400 uppercase tracking-widest">{uploadingImage ? 'Subiendo...' : 'Subir Imagen'}</span>
                                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
                                            </label>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-secondary-400 font-bold text-center px-4">Utiliza una imagen de alta calidad (JPG, PNG, WEBP) para mejores resultados.</p>
                                </div>

                                {/* Form Fields */}
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-secondary-400 uppercase tracking-widest px-2">Nombre del Producto</label>
                                        <input
                                            type="text"
                                            required
                                            value={newProduct.name}
                                            onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                            className="w-full px-6 py-4 bg-secondary-50 border border-secondary-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold text-secondary-900"
                                            placeholder="Ej. Pizza Margarita"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-black text-secondary-400 uppercase tracking-widest px-2">Precio ($)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                required
                                                value={newProduct.price}
                                                onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                                                className="w-full px-6 py-4 bg-secondary-50 border border-secondary-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold text-secondary-900"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-black text-secondary-400 uppercase tracking-widest px-2">Categoría</label>
                                            <select
                                                required
                                                value={newProduct.category_id}
                                                onChange={(e) => setNewProduct({ ...newProduct, category_id: e.target.value })}
                                                className="w-full px-6 py-4 bg-secondary-50 border border-secondary-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold text-secondary-900 appearance-none"
                                            >
                                                <option value="">Seleccionar...</option>
                                                {categories.map((cat) => (
                                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-secondary-400 uppercase tracking-widest px-2">Descripción (Opcional)</label>
                                        <textarea
                                            value={newProduct.description}
                                            onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                                            className="w-full px-6 py-4 bg-secondary-50 border border-secondary-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold text-secondary-900 resize-none h-32"
                                            placeholder="Breve descripción del producto..."
                                        />
                                    </div>

                                    <div className="space-y-4">
                                        <label className="block text-[10px] font-black text-secondary-400 uppercase tracking-widest px-2">Ingredientes del Producto</label>
                                        <div className="max-h-48 overflow-y-auto p-2 bg-secondary-50 rounded-2xl border border-secondary-100 space-y-2">
                                            {allIngredients.map((ing) => {
                                                const isSelected = selectedIngredients.some(si => si.ingredient_id === ing.id);
                                                const selectedIng = selectedIngredients.find(si => si.ingredient_id === ing.id);

                                                return (
                                                    <div
                                                        key={ing.id}
                                                        className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all flex flex-col gap-2 sm:gap-3 ${isSelected ? 'bg-primary-50 border-primary-200' : 'bg-secondary-50/50 border-secondary-100'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedIngredients([...selectedIngredients, { ingredient_id: ing.id, is_removable: true }]);
                                                                    } else {
                                                                        setSelectedIngredients(selectedIngredients.filter(si => si.ingredient_id !== ing.id));
                                                                    }
                                                                }}
                                                                className="w-5 h-5 rounded border-secondary-200 text-primary-500 focus:ring-primary-500"
                                                            />
                                                            <span className={`font-bold text-sm ${isSelected ? 'text-primary-900' : 'text-secondary-600'}`}>
                                                                {ing.name}
                                                            </span>
                                                        </div>

                                                        {isSelected && (
                                                            <div className="flex items-center gap-2 pl-8">
                                                                <input
                                                                    type="checkbox"
                                                                    id={`removable-${ing.id}`}
                                                                    checked={selectedIng?.is_removable}
                                                                    onChange={(e) => {
                                                                        setSelectedIngredients(selectedIngredients.map(si =>
                                                                            si.ingredient_id === ing.id
                                                                                ? { ...si, is_removable: e.target.checked }
                                                                                : si
                                                                        ));
                                                                    }}
                                                                    className="w-4 h-4 rounded border-secondary-200 text-primary-500 focus:ring-primary-500"
                                                                />
                                                                <label htmlFor={`removable-${ing.id}`} className="text-[9px] sm:text-[10px] font-black uppercase text-primary-600 tracking-wider">
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
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
