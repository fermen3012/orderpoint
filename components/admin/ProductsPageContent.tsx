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
import {
    saveProduct,
    createCategoryAction,
    createIngredientAction,
    deleteProductAction,
    toggleProductAvailabilityAction
} from '@/actions/products';
import imageCompression from 'browser-image-compression';

const parseLocalizedField = (val: any): { es: string; en: string } => {
    if (!val) return { es: '', en: '' };
    
    let current = val;
    
    // Attempt parsing up to 3 times to handle double/triple serialization and outer quotes
    for (let i = 0; i < 3; i++) {
        if (typeof current === 'string') {
            try {
                const parsed = JSON.parse(current);
                if (parsed !== null && parsed !== undefined) {
                    current = parsed;
                } else {
                    break;
                }
            } catch (e) {
                break;
            }
        } else {
            break;
        }
    }
    
    if (current && typeof current === 'object') {
        const getVal = (keys: string[]) => {
            for (const k of keys) {
                const foundKey = Object.keys(current).find(pk => pk.toLowerCase() === k.toLowerCase());
                if (foundKey) return current[foundKey];
            }
            return '';
        };
        return {
            es: getVal(['es']) || '',
            en: getVal(['en']) || ''
        };
    }
    
    if (typeof current === 'string') {
        return { es: current, en: '' };
    }
    
    return { es: '', en: '' };
};

export default function ProductsPageContent({ restaurantId: propRestaurantId }: { restaurantId?: string }) {
    const t = useTranslations('admin');
    const router = useRouter();
    const { restaurantId: authRestaurantId } = useAuth();
    const restaurantId = propRestaurantId || authRestaurantId;
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
    const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [creatingCategory, setCreatingCategory] = useState(false);
    const [isNewIngredientModalOpen, setIsNewIngredientModalOpen] = useState(false);
    const [newIngredientName, setNewIngredientName] = useState('');
    const [creatingIngredient, setCreatingIngredient] = useState(false);

    const [newProduct, setNewProduct] = useState({
        name: { es: '', en: '' },
        description: { es: '', en: '' },
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
            name: { es: '', en: '' },
            description: { es: '', en: '' },
            price: '',
            category_id: categories[0]?.id || '',
            image_url: '',
            is_available: true
        });
        setSelectedIngredients([]);
    };

    const handleCreateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!restaurantId || !newCategoryName.trim()) return;
        setCreatingCategory(true);

        try {
            const result = await createCategoryAction(newCategoryName.trim(), restaurantId);

            if (result.error) throw new Error(result.error);

            if (result.data) {
                const supabase = createClient();
                const { data: updatedCats } = await (supabase
                    .from('categories' as any) as any)
                    .select('*')
                    .eq('restaurant_id', restaurantId)
                    .order('name', { ascending: true });
                
                if (updatedCats) {
                    setCategories(updatedCats);
                }
                
                setNewProduct(prev => ({ ...prev, category_id: result.data.id }));
                setIsNewCategoryModalOpen(false);
                setNewCategoryName('');
            }
        } catch (err: any) {
            console.error('Error creating category:', err);
            alert(`Error al crear la categoría: ${err.message}`);
        } finally {
            setCreatingCategory(false);
        }
    };

    const handleCreateIngredient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!restaurantId || !newIngredientName.trim()) return;
        setCreatingIngredient(true);

        try {
            const result = await createIngredientAction(newIngredientName.trim(), restaurantId);

            if (result.error) throw new Error(result.error);

            if (result.data) {
                const supabase = createClient();
                const { data: updatedIngs } = await (supabase
                    .from('ingredients' as any) as any)
                    .select('*')
                    .eq('restaurant_id', restaurantId)
                    .order('name', { ascending: true });
                
                if (updatedIngs) {
                    setAllIngredients(updatedIngs);
                }
                
                setSelectedIngredients(prev => [...prev, { ingredient_id: result.data.id, is_removable: true }]);
                setIsNewIngredientModalOpen(false);
                setNewIngredientName('');
            }
        } catch (err: any) {
            console.error('Error creating ingredient:', err);
            alert(`Error al crear el ingrediente: ${err.message}`);
        } finally {
            setCreatingIngredient(false);
        }
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
        const nameToTranslate = newProduct.name.es?.trim();
        const descToTranslate = newProduct.description.es?.trim();
        if (!nameToTranslate && !descToTranslate) return;
        setIsTranslating(true);
        try {
            let updatedName = { ...newProduct.name };
            let updatedDesc = { ...newProduct.description };

            if (nameToTranslate) {
                const nameRes = await generateDualTranslation(nameToTranslate);
                if (nameRes) {
                    updatedName = { es: nameRes.es, en: nameRes.en };
                }
            }

            if (descToTranslate) {
                const descRes = await generateDualTranslation(descToTranslate);
                if (descRes) {
                    updatedDesc = { es: descRes.es, en: descRes.en };
                }
            }

            setNewProduct(prev => ({
                ...prev,
                name: updatedName,
                description: updatedDesc
            }));
        } catch (error: any) {
            console.error('Translation failed', error);
            alert('Error al traducir: ' + error.message + '\n\nRevisa si el servidor o la API key de IA están correctamente configurados.');
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
                description: (newProduct.description.es || newProduct.description.en) ? newProduct.description : null,
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
            name: parseLocalizedField(product.name),
            description: parseLocalizedField(product.description),
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
            const result = await deleteProductAction(id);
            if (!result.error) {
                loadData();
            } else {
                alert(`Error al eliminar: ${result.error}`);
            }
        }
    };

    const handleToggleAvailability = async (id: string, currentStatus: boolean) => {
        const result = await toggleProductAvailabilityAction(id, currentStatus);
        if (!result.error) {
            setProducts(prev => prev.map(p => p.id === id ? { ...p, is_available: !currentStatus } : p));
        } else {
            alert(`Error al cambiar disponibilidad: ${result.error}`);
        }
    };

    const handleLogout = async () => {
        await adminSupabase.auth.signOut();
        router.push('/login');
    };

    const filteredProducts = products.filter(p =>
        (parseLocalizedField(p.name).es).toLowerCase().includes(searchQuery.toLowerCase()) ||
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
                                        alt={parseLocalizedField(product.name).es}
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
                                    <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-tight line-clamp-1">
                                        {parseLocalizedField(product.name).es || 'Sin nombre'}
                                    </h3>
                                    <span className="text-xl font-black text-emerald-500 italic tracking-tighter truncate">
                                        {formatPrice(product.price, 'es-SV')}
                                    </span>
                                </div>
                                <p className="text-slate-500 font-bold text-xs line-clamp-2 mb-8 flex-1">
                                    {parseLocalizedField(product.description).es || 'Sin descripción disponible.'}
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
                                                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-4 backdrop-blur-sm p-6">
                                                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Cambiar Fotografía</span>
                                                    <div className="flex gap-3 w-full">
                                                        <label className="flex-1 cursor-pointer bg-emerald-500 hover:bg-emerald-600 text-slate-900 py-3.5 px-2 rounded-xl font-black uppercase tracking-wider text-[8px] flex items-center justify-center gap-1.5 active:scale-95 transition-all text-center">
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            </svg>
                                                            <span>Cámara</span>
                                                            <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleImageUpload} disabled={uploadingImage} />
                                                        </label>
                                                        <label className="flex-1 cursor-pointer bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white py-3.5 px-2 rounded-xl font-black uppercase tracking-wider text-[8px] flex items-center justify-center gap-1.5 active:scale-95 transition-all text-center">
                                                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                            </svg>
                                                            <span>Galería</span>
                                                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
                                                        </label>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center p-6">
                                                <div className="w-16 h-16 bg-slate-800 rounded-3xl flex items-center justify-center mb-6 border border-slate-700">
                                                    {uploadingImage ? <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /> : <ImageIcon className="w-8 h-8 text-slate-600" />}
                                                </div>
                                                
                                                {uploadingImage ? (
                                                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest animate-pulse">Procesando...</span>
                                                ) : (
                                                    <div className="flex flex-col sm:flex-row gap-4 w-full px-4">
                                                        <label className="flex-1 cursor-pointer bg-slate-900 hover:bg-slate-800 border border-slate-850 hover:border-emerald-500 text-white py-3.5 px-4 rounded-2xl font-black uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg text-center">
                                                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            </svg>
                                                            <span>Tomar Foto</span>
                                                            <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleImageUpload} disabled={uploadingImage} />
                                                        </label>

                                                        <label className="flex-1 cursor-pointer bg-slate-900 hover:bg-slate-800 border border-slate-850 hover:border-emerald-500 text-white py-3.5 px-4 rounded-2xl font-black uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg text-center">
                                                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                            </svg>
                                                            <span>Galería</span>
                                                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
                                                        </label>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-600 font-bold text-center px-6 italic">Tamaño recomendado: 1024x1024px. Máx 2MB.</p>
                                </div>
                            </div>

                            {/* Details Section */}
                            <div className="lg:col-span-7 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Nombre del Plato (Español)</label>
                                        <input
                                            type="text"
                                            required
                                            value={newProduct.name.es}
                                            onChange={(e) => setNewProduct({ ...newProduct, name: { ...newProduct.name, es: e.target.value } })}
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
                                                className="w-full pl-12 pr-6 py-5 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-white text-xl"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-3 md:col-span-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Nombre en Inglés (Opcional - Autotraducido por IA)</label>
                                        <input
                                            type="text"
                                            value={newProduct.name.en}
                                            onChange={(e) => setNewProduct({ ...newProduct, name: { ...newProduct.name, en: e.target.value } })}
                                            className="w-full px-6 py-5 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-slate-400 uppercase italic tracking-tighter text-base"
                                            placeholder="EJ. SPICY PORK TACOS"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Categoría del Menú</label>
                                    <div className="flex gap-4 items-center">
                                        <div className="relative flex-1">
                                            <select
                                                required
                                                value={newProduct.category_id}
                                                onChange={(e) => setNewProduct({ ...newProduct, category_id: e.target.value })}
                                                className="w-full px-6 py-5 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-white appearance-none uppercase tracking-widest text-xs pr-12"
                                            >
                                                <option value="" className="bg-slate-900">Seleccionar Categoría...</option>
                                                {categories.map((cat) => (
                                                    <option key={cat.id} value={cat.id} className="bg-slate-900">{cat.name.toUpperCase()}</option>
                                                ))}
                                            </select>
                                        </div>
                                        
                                        <button
                                            type="button"
                                            onClick={() => setIsNewCategoryModalOpen(true)}
                                            className="w-[60px] h-[60px] flex items-center justify-center bg-slate-950 border border-slate-800 text-emerald-500 hover:text-slate-900 hover:bg-emerald-500 hover:border-emerald-500 rounded-2xl transition-all shrink-0 active:scale-95 shadow-lg group"
                                            title="Nueva Categoría"
                                        >
                                            <Plus className="w-6 h-6 transition-transform group-hover:rotate-90 duration-300" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3 relative group">
                                    <div className="flex justify-between items-center px-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Descripción Gastronómica (Español)</label>
                                        <button
                                            type="button"
                                            onClick={handleTranslate}
                                            disabled={isTranslating || (!newProduct.name.es?.trim() && !newProduct.description.es?.trim())}
                                            className="px-4 py-1 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-slate-900 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all transition-colors flex items-center gap-2"
                                        >
                                            {isTranslating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                            IA: Traducir Nombre y Desc.
                                        </button>
                                    </div>
                                    <textarea
                                        value={newProduct.description.es}
                                        onChange={(e) => setNewProduct({ ...newProduct, description: { ...newProduct.description, es: e.target.value } })}
                                        className="w-full px-6 py-5 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-white text-sm min-h-[120px] resize-none"
                                        placeholder="Escribe una descripción tentadora en español..."
                                    />
                                    <textarea
                                        value={newProduct.description.en}
                                        onChange={(e) => setNewProduct({ ...newProduct, description: { ...newProduct.description, en: e.target.value } })}
                                        className="w-full px-6 py-5 bg-slate-950/50 border border-slate-800/50 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-slate-400 text-sm min-h-[120px] resize-none mt-2"
                                        placeholder="Descripción en Inglés (Opcional - Autotraducido por IA)..."
                                    />
                                </div>

                                {/* Ingredients Selection */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center px-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Personalización (Ingredientes)</label>
                                        <button
                                            type="button"
                                            onClick={() => setIsNewIngredientModalOpen(true)}
                                            className="px-4 py-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-slate-900 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all transition-colors flex items-center gap-2"
                                        >
                                            <Plus className="w-3 h-3" />
                                            Nuevo Ingrediente
                                        </button>
                                    </div>
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

            {/* New Category Modal */}
            {isNewCategoryModalOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-800/80 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="relative p-8 pb-4 border-b border-slate-800/50 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-black text-white tracking-tight uppercase">Nueva Categoría</h2>
                                <p className="text-[10px] font-black text-slate-500 tracking-wider uppercase mt-1">Configuración de Menú</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsNewCategoryModalOpen(false);
                                    setNewCategoryName('');
                                }}
                                className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateCategory} className="p-8 space-y-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Nombre de la Categoría</label>
                                <input
                                    type="text"
                                    required
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    className="w-full px-6 py-5 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-white uppercase tracking-wider text-sm"
                                    placeholder="Ej: Entradas, Postres, Bebidas..."
                                />
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsNewCategoryModalOpen(false);
                                        setNewCategoryName('');
                                    }}
                                    className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 text-xs"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={creatingCategory || !newCategoryName.trim()}
                                    className="flex-[2] py-4 bg-emerald-500 text-slate-900 rounded-2xl font-black uppercase tracking-widest shadow-[0_10px_20px_rgba(16,185,129,0.2)] hover:bg-emerald-400 transition-all active:scale-95 disabled:opacity-50 text-xs"
                                >
                                    {creatingCategory ? 'Creando...' : 'Crear Categoría'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* New Ingredient Modal */}
            {isNewIngredientModalOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-800/80 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="relative p-8 pb-4 border-b border-slate-800/50 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-black text-white tracking-tight uppercase">Nuevo Ingrediente</h2>
                                <p className="text-[10px] font-black text-slate-500 tracking-wider uppercase mt-1">Configuración de Menú</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsNewIngredientModalOpen(false);
                                    setNewIngredientName('');
                                }}
                                className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateIngredient} className="p-8 space-y-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Nombre del Ingrediente</label>
                                <input
                                    type="text"
                                    required
                                    value={newIngredientName}
                                    onChange={(e) => setNewIngredientName(e.target.value)}
                                    className="w-full px-6 py-5 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-white uppercase tracking-wider text-sm"
                                    placeholder="Ej: Tocino, Queso Cheddar, Jalapeños..."
                                />
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsNewIngredientModalOpen(false);
                                        setNewIngredientName('');
                                    }}
                                    className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 text-xs"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={creatingIngredient || !newIngredientName.trim()}
                                    className="flex-[2] py-4 bg-emerald-500 text-slate-900 rounded-2xl font-black uppercase tracking-widest shadow-[0_10px_20px_rgba(16,185,129,0.2)] hover:bg-emerald-400 transition-all active:scale-95 disabled:opacity-50 text-xs"
                                >
                                    {creatingIngredient ? 'Creando...' : 'Crear Ingrediente'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
