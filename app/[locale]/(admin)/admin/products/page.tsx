'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/browser';
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
    X,
    X as CloseIcon,
    Image as ImageIcon,
    Search,
    ChefHat,
    Loader2,
    Sparkles,
    RefreshCw
} from 'lucide-react';
import { generateDualTranslation } from '@/actions/translate-gemini';
import { formatPrice } from '@/lib/utils';
import { SidebarLink } from '@/components/admin/SidebarLink';

import { useAuth } from '@/components/auth/AuthContext';
import { saveProduct } from '@/actions/products';

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
    const [isTranslating, setIsTranslating] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [allIngredients, setAllIngredients] = useState<any[]>([]);
    const [selectedIngredients, setSelectedIngredients] = useState<{ ingredient_id: string, is_removable: boolean }[]>([]);

    const [newProduct, setNewProduct] = useState({
        name: '',
        description: '',
        description_es: '',
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
            description_es: '',
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

            const supabase = createClient();
            const { error: uploadError } = await supabase.storage
                .from('products')
                .upload(filePath, compressedFile);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('products')
                .getPublicUrl(filePath);

            setNewProduct(prev => ({ ...prev, image_url: publicUrl }));
        } catch (error: any) {
            console.error('Error uploading image:', error);
            // Revert to simple alert for user
            alert(`Error al subir la imagen: ${error.message}`);
        } finally {
            setUploadingImage(false);
        }
    };

    const handleTranslate = async () => {
        if (!newProduct.description) return;
        setIsTranslating(true);
        try {
            const result = await generateDualTranslation(newProduct.description);
            if (result && result.es && result.en) {
                setNewProduct(prev => ({
                    ...prev,
                    description: result.en, // Refinado en Inglés
                    description_es: result.es // Traducido en Español
                }));
            }
        } catch (error: any) {
            console.error('Translation failed', error);
            alert('Error al traducir: ' + error.message + '\n\nRevisa si reiniciaste el servidor.');
        } finally {
            setIsTranslating(false);
        }
    };

    const handleSaveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!restaurantId) return;
        setSaving(true);

        try {
            const productData = {
                id: editingProduct?.id,
                restaurant_id: restaurantId,
                name: newProduct.name,
                description: newProduct.description || null,
                description_es: newProduct.description_es || null,
                price: parseFloat(newProduct.price),
                category_id: newProduct.category_id || null, // Ensure empty string becomes null if needed, though state is string
                image_url: newProduct.image_url || null,
                is_available: newProduct.is_available
            };

            // Clean category_id empty string to null
            if (productData.category_id === '') productData.category_id = null;

            const result = await saveProduct(productData, selectedIngredients);

            if (result.success) {
                console.log('Product saved successfully:', result.productId);
                setIsModalOpen(false);
                setEditingProduct(null);
                resetForm();
                loadData();
            } else {
                console.error('Error saving product (server action):', result.error);
                alert(`Error al guardar: ${result.error}`);
            }
        } catch (err: any) {
            console.error('Unexpected error saving product:', err);
            alert(`Error inesperado: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleEditClick = async (product: any) => {
        setEditingProduct(product);
        setNewProduct({
            name: product.name,
            description: product.description || '',
            description_es: (product as any).description_es || '',
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
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Cargando Menú...</p>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-8 h-1 bg-emerald-500 rounded-full"></span>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Inventario de Cocina</span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        {t('products')}
                    </h1>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                    <div className="relative group w-full sm:w-80">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar producto..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-16 pr-8 py-4 bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-white placeholder:text-slate-600"
                        />
                    </div>

                    <button
                        onClick={() => {
                            setEditingProduct(null);
                            resetForm();
                            setIsModalOpen(true);
                        }}
                        className="group relative flex items-center justify-center gap-3 px-8 py-4 bg-emerald-500 text-slate-900 rounded-2xl font-black uppercase tracking-widest shadow-[0_10px_20px_rgba(16,185,129,0.2)] hover:-translate-y-1 transition-all active:scale-95"
                    >
                        <Plus className="w-6 h-6" />
                        <span>Añadir Nuevo</span>
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {filteredProducts.map((product) => (
                        <div key={product.id} className="group relative bg-slate-900/40 backdrop-blur-sm rounded-[3rem] border border-slate-800 hover:border-emerald-500/30 transition-all duration-500 overflow-hidden flex flex-col">
                            {/* Stats/Badge */}
                            <div className="absolute top-6 left-6 z-10">
                                <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-950/80 text-emerald-500 border border-emerald-500/20 backdrop-blur-md">
                                    {product.categories?.name || 'Gral'}
                                </span>
                            </div>

                            <div className="absolute top-6 right-6 z-10 flex flex-col gap-2">
                                <button
                                    onClick={() => handleToggleAvailability(product.id, product.is_available)}
                                    className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all shadow-lg ${product.is_available
                                        ? 'bg-emerald-500 text-slate-900'
                                        : 'bg-red-500/20 text-red-500 border border-red-500/30'
                                        }`}
                                >
                                    {product.is_available ? <ChefHat className="w-5 h-5" /> : <X className="w-5 h-5" />}
                                </button>
                            </div>

                            {/* Image Section */}
                            <div className="aspect-[4/3] relative overflow-hidden bg-slate-800">
                                {product.image_url ? (
                                    <img
                                        src={product.image_url}
                                        alt={product.name}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Package className="w-16 h-16 text-slate-700" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent opacity-60"></div>
                            </div>

                            {/* Info Section */}
                            <div className="p-8 flex-1 flex flex-col">
                                <div className="flex justify-between items-start mb-4 gap-4">
                                    <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-tight line-clamp-1">{product.name}</h3>
                                    <span className="text-xl font-black text-emerald-500 italic tracking-tighter truncate">
                                        {formatPrice(product.price, 'es-SV')}
                                    </span>
                                </div>
                                <p className="text-slate-500 font-bold text-xs line-clamp-2 mb-8 flex-1">
                                    {product.description || 'Sin descripción disponible.'}
                                </p>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleEditClick(product)}
                                        className="flex-1 py-4 bg-slate-800 hover:bg-emerald-500 text-slate-400 hover:text-slate-900 rounded-2xl transition-all font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
                                    >
                                        <Pencil className="w-4 h-4" />
                                        Editar
                                    </button>
                                    <button
                                        onClick={() => handleDeleteProduct(product.id)}
                                        className="p-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl transition-all border border-red-500/20"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="p-20 text-center bg-slate-900/30 rounded-[3rem] border border-dashed border-slate-800">
                    <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Package className="w-10 h-10 text-slate-600" />
                    </div>
                    <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-2">No hay productos</h3>
                    <p className="text-slate-500 font-bold text-sm">Empieza por añadir tu primer plato al menú.</p>
                </div>
            )}

            {/* Redesigned Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl transition-all duration-500 animate-in fade-in overflow-y-auto custom-scrollbar">
                    <div className="bg-slate-900 w-full max-w-5xl rounded-[3rem] border border-slate-800 shadow-2xl relative animate-in zoom-in-95 duration-500 my-auto">
                        <div className="p-8 md:p-12 border-b border-slate-800/50 flex justify-between items-center sticky top-0 bg-slate-900/80 backdrop-blur-md z-10">
                            <div>
                                <h1 className="text-3xl md:text-4xl font-black text-white italic tracking-tighter uppercase leading-none">
                                    {editingProduct ? 'Editar Plato' : 'Nuevo Plato'}
                                </h1>
                                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px] mt-2 italic">Configuración de Menú</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl transition-all"
                            >
                                <CloseIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveProduct} className="p-8 md:p-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
                            {/* Image Section */}
                            <div className="lg:col-span-5 space-y-6">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Fotografía del Plato</label>
                                    <div className="aspect-square bg-slate-950 rounded-[3rem] border-2 border-dashed border-slate-800 overflow-hidden relative group transition-all hover:border-emerald-500/50">
                                        {newProduct.image_url ? (
                                            <>
                                                <img src={newProduct.image_url} alt="Preview" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-sm">
                                                    <label className="cursor-pointer bg-emerald-500 text-slate-900 px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all text-xs">
                                                        Cambiar Foto
                                                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
                                                    </label>
                                                </div>
                                            </>
                                        ) : (
                                            <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-slate-900 transition-colors">
                                                <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center mb-4 border border-slate-700">
                                                    {uploadingImage ? <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" /> : <ImageIcon className="w-10 h-10 text-slate-600" />}
                                                </div>
                                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{uploadingImage ? 'Procesando...' : 'Subir Imagen'}</span>
                                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
                                            </label>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-600 font-bold text-center px-6 italic">Tamaño recomendado: 1024x1024px. Máx 2MB.</p>
                                </div>
                            </div>

                            {/* Details Section */}
                            <div className="lg:col-span-7 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Nombre del Plato</label>
                                        <input
                                            type="text"
                                            required
                                            value={newProduct.name}
                                            onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                            className="w-full px-6 py-5 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-white uppercase italic tracking-tighter text-lg"
                                            placeholder="EJ. TACOS AL PASTOR"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Precio de Venta</label>
                                        <div className="relative group">
                                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-500 font-black text-xl">$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                required
                                                value={newProduct.price}
                                                onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                                                className="w-full pl-12 pr-6 py-5 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-white text-xl"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Categoría del Menú</label>
                                    <select
                                        required
                                        value={newProduct.category_id}
                                        onChange={(e) => setNewProduct({ ...newProduct, category_id: e.target.value })}
                                        className="w-full px-6 py-5 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-white appearance-none uppercase tracking-widest text-xs"
                                    >
                                        <option value="" className="bg-slate-900">Seleccionar Categoría...</option>
                                        {categories.map((cat) => (
                                            <option key={cat.id} value={cat.id} className="bg-slate-900">{cat.name.toUpperCase()}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-3 relative group">
                                    <div className="flex justify-between items-center px-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Descripción Gastronómica</label>
                                        <button
                                            type="button"
                                            onClick={handleTranslate}
                                            disabled={isTranslating || !newProduct.description}
                                            className="px-4 py-1 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-slate-900 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all transition-colors flex items-center gap-2"
                                        >
                                            {isTranslating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                            IA: Mejorar & Traducir
                                        </button>
                                    </div>
                                    <textarea
                                        value={newProduct.description_es}
                                        onChange={(e) => setNewProduct({ ...newProduct, description_es: e.target.value })}
                                        className="w-full px-6 py-5 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-white text-sm min-h-[120px] resize-none"
                                        placeholder="Escribe una descripción tentadora en español..."
                                    />
                                    <input
                                        type="text"
                                        value={newProduct.description}
                                        onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-950/50 border border-slate-800/50 rounded-xl text-xs font-bold text-slate-600 outline-none focus:border-slate-700 transition-all mt-2"
                                        placeholder="English description / AI Target..."
                                    />
                                </div>

                                {/* Ingredients Selection */}
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Personalización (Ingredientes)</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-60 overflow-y-auto pr-4 custom-scrollbar">
                                        {allIngredients.map((ing) => {
                                            const isSelected = selectedIngredients.some(si => si.ingredient_id === ing.id);
                                            const selectedIng = selectedIngredients.find(si => si.ingredient_id === ing.id);

                                            return (
                                                <div
                                                    key={ing.id}
                                                    className={`p-5 rounded-3xl border transition-all flex flex-col gap-4 ${isSelected
                                                        ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                                                        : 'bg-slate-950 border-slate-800'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={(e) => {
                                                                const isChecked = e.target.checked;
                                                                setSelectedIngredients(prev => isChecked
                                                                    ? [...prev, { ingredient_id: ing.id, is_removable: true }]
                                                                    : prev.filter(si => si.ingredient_id !== ing.id)
                                                                );
                                                            }}
                                                            className="w-6 h-6 rounded-lg border-slate-800 bg-slate-900 text-emerald-500 focus:ring-emerald-500/20"
                                                        />
                                                        <span className={`font-black uppercase tracking-widest text-[10px] ${isSelected ? 'text-emerald-500' : 'text-slate-500'}`}>
                                                            {ing.name}
                                                        </span>
                                                    </div>
                                                    {isSelected && (
                                                        <div className="flex items-center gap-3 pl-10 border-t border-emerald-500/10 pt-4">
                                                            <input
                                                                type="checkbox"
                                                                id={`rem-${ing.id}`}
                                                                checked={selectedIng?.is_removable}
                                                                onChange={(e) => {
                                                                    const isChecked = e.target.checked;
                                                                    setSelectedIngredients(prev => prev.map(si =>
                                                                        si.ingredient_id === ing.id ? { ...si, is_removable: isChecked } : si
                                                                    ));
                                                                }}
                                                                className="w-4 h-4 rounded border-emerald-500/30 bg-slate-900 text-emerald-500"
                                                            />
                                                            <label htmlFor={`rem-${ing.id}`} className="text-[9px] font-black uppercase text-emerald-500/60 tracking-wider cursor-pointer">
                                                                MESERO PUEDE QUITARLO
                                                            </label>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {allIngredients.length === 0 && (
                                            <div className="col-span-2 p-8 text-center bg-slate-950 rounded-3xl border border-slate-800 italic text-slate-600 text-xs">
                                                No hay ingredientes registrados en el sistema.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Sticky Bottom Actions */}
                            <div className="lg:col-span-12 flex flex-col md:flex-row gap-6 pt-12 border-t border-slate-800/50 mt-8">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-6 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-[2rem] font-black uppercase tracking-widest transition-all active:scale-95 text-xs shadow-xl"
                                >
                                    Descartar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-[2] py-6 bg-emerald-500 text-slate-900 rounded-[2rem] font-black uppercase tracking-widest shadow-[0_10px_40px_rgba(16,185,129,0.3)] hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0 text-xs"
                                >
                                    {saving ? 'Procesando...' : (editingProduct ? 'Confirmar Cambios' : 'Lanzar Plato')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
