'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/browser';
import { adminSupabase } from '@/lib/supabase/admin-client';
import { useRouter } from '@/i18n/routing';
import imageCompression from 'browser-image-compression';
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
    ChefHat
} from 'lucide-react';
import { SidebarLink } from '@/components/admin/SidebarLink';

import { useAuth } from '@/components/auth/AuthContext';

export default function CategoriesPage() {
    const t = useTranslations('admin');
    const router = useRouter();
    const { restaurantId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<any | null>(null);
    const [newCategory, setNewCategory] = useState({ name: '', image_url: '' });
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    useEffect(() => {
        if (restaurantId) {
            loadCategories();
        }
    }, [restaurantId]);

    const loadCategories = async () => {
        if (!restaurantId) return;
        setLoading(true);
        const { data } = await (adminSupabase
            .from('categories' as any) as any)
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('sort_order', { ascending: true });

        if (data) setCategories(data);
        setLoading(false);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingImage(true);
        try {
            const options = {
                maxSizeMB: 0.2, // 200KB
                maxWidthOrHeight: 1024,
                useWebWorker: true,
            };

            const compressedFile = await imageCompression(file, options);
            const fileExt = file.name.split('.').pop();
            const fileName = `categories/${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;

            const supabase = createClient();
            const { error: uploadError } = await supabase.storage
                .from('products') // Using 'products' bucket for categories too, or 'categories' if exists? ProductsPage used 'products'.
                .upload(fileName, compressedFile);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('products')
                .getPublicUrl(fileName);

            setNewCategory(prev => ({ ...prev, image_url: publicUrl }));
        } catch (error: any) {
            console.error('Error uploading image:', error);
            alert(`Error al subir la imagen: ${error.message}`);
        } finally {
            setUploadingImage(false);
        }
    };

    const removeCategoryStorageImage = async (imageUrl: string | null | undefined) => {
        if (!imageUrl || typeof imageUrl !== 'string') return;
        const marker = '/storage/v1/object/public/';
        const idx = imageUrl.indexOf(marker);
        if (idx === -1) return;
        const afterMarker = imageUrl.substring(idx + marker.length).split('?')[0];
        const firstSlash = afterMarker.indexOf('/');
        if (firstSlash === -1) return;
        const bucket = decodeURIComponent(afterMarker.substring(0, firstSlash));
        const path = decodeURIComponent(afterMarker.substring(firstSlash + 1));
        if (!bucket || !path) return;
        try {
            const supabase = createClient();
            await supabase.storage.from(bucket).remove([path]);
        } catch (err) {
            console.warn('Error removing category image from storage:', err);
        }
    };

    const handleSaveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!restaurantId) return;
        setSaving(true);

        if (editingCategory) {
            const oldImageUrl = editingCategory.image_url;
            const { error } = await (adminSupabase.from('categories' as any) as any)
                .update({
                    name: newCategory.name,
                    image_url: newCategory.image_url || null
                })
                .eq('id', editingCategory.id);

            if (!error) {
                if (oldImageUrl && oldImageUrl !== (newCategory.image_url || null)) {
                    await removeCategoryStorageImage(oldImageUrl);
                }
                setIsModalOpen(false);
                setEditingCategory(null);
                setNewCategory({ name: '', image_url: '' });
                loadCategories();
            }
        } else {
            const { error } = await (adminSupabase.from('categories' as any) as any).insert({
                name: newCategory.name,
                image_url: newCategory.image_url || null,
                restaurant_id: restaurantId,
                sort_order: categories.length + 1
            } as any);

            if (!error) {
                setIsModalOpen(false);
                setNewCategory({ name: '', image_url: '' });
                loadCategories();
            }
        }
        setSaving(false);
    };

    const handleEditClick = (category: any) => {
        setEditingCategory(category);
        setNewCategory({
            name: category.name,
            image_url: category.image_url || ''
        });
        setIsModalOpen(true);
    };

    const handleDeleteCategory = async (id: string) => {
        if (confirm(t('deleteCategoryConfirm'))) {
            const targetCat = categories.find(c => c.id === id);
            const { error } = await (adminSupabase.from('categories' as any) as any).delete().eq('id', id);
            if (!error) {
                if (targetCat?.image_url) {
                    await removeCategoryStorageImage(targetCat.image_url);
                }
                loadCategories();
            }
        }
    };

    const handleLogout = async () => {
        await adminSupabase.auth.signOut();
        router.push('/login');
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">{t('loadingCategories')}</p>
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
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">{t('menuArchitecture')}</span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        {t('categories')}
                    </h1>
                </div>

                <button
                    onClick={() => {
                        setEditingCategory(null);
                        setNewCategory({ name: '', image_url: '' });
                        setIsModalOpen(true);
                    }}
                    className="group relative flex items-center justify-center gap-3 px-10 py-4 bg-emerald-500 text-slate-900 rounded-2xl font-black uppercase tracking-widest shadow-[0_10px_20px_rgba(16,185,129,0.2)] hover:-translate-y-1 transition-all active:scale-95 w-full lg:w-auto"
                >
                    <Plus className="w-6 h-6" />
                    <span>{t('newCategory')}</span>
                </button>
            </div>

            {/* Grid Area */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {categories.map((category, idx) => (
                    <div
                        key={category.id}
                        className="group relative bg-slate-900/40 backdrop-blur-sm rounded-[3rem] p-8 border border-slate-800 hover:border-emerald-500/30 transition-all duration-500 flex flex-col items-center animate-in zoom-in slide-in-from-bottom-4"
                        style={{ animationDelay: `${idx * 100}ms` }}
                    >
                        {/* Image/Icon Circle */}
                        <div className="relative w-40 h-40 rounded-full bg-slate-950 mb-8 overflow-hidden flex items-center justify-center border-4 border-slate-800 group-hover:border-emerald-500/20 transition-all duration-500 shadow-2xl">
                            {category.image_url ? (
                                <img
                                    src={category.image_url}
                                    alt={category.name}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                />
                            ) : (
                                <List className="w-16 h-16 text-slate-700 group-hover:text-emerald-500 transition-colors" />
                            )}

                            {/* Overlay Actions */}
                            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3">
                                <button
                                    onClick={() => handleEditClick(category)}
                                    className="p-4 bg-emerald-500 text-slate-900 rounded-2xl hover:scale-110 transition-all shadow-xl"
                                >
                                    <Pencil className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => handleDeleteCategory(category.id)}
                                    className="p-4 bg-red-500 text-white rounded-2xl hover:scale-110 transition-all shadow-xl"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="text-center">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">{t('section')} {idx + 1}</span>
                            <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-tight group-hover:text-emerald-500 transition-colors">
                                {category.name}
                            </h3>
                        </div>
                    </div>
                ))}

                {/* Empty State / Add Card */}
                <button
                    onClick={() => {
                        setEditingCategory(null);
                        setNewCategory({ name: '', image_url: '' });
                        setIsModalOpen(true);
                    }}
                    className="group relative bg-slate-900/20 rounded-[3rem] p-8 border-2 border-dashed border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-500/[0.02] transition-all duration-500 flex flex-col items-center justify-center min-h-[300px]"
                >
                    <div className="w-16 h-16 rounded-3xl bg-slate-800 flex items-center justify-center mb-6 group-hover:bg-emerald-500 group-hover:text-slate-900 transition-all duration-500">
                        <Plus className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-black text-slate-600 uppercase tracking-widest group-hover:text-emerald-500 transition-colors">{t('addCategory')}</span>
                </button>
            </div>

            {/* Modal Redesign */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-500">
                    <div className="bg-slate-900 w-full max-w-xl rounded-[3rem] border border-slate-800 shadow-2xl relative animate-in zoom-in-95 duration-300">
                        <div className="p-10 md:p-12 border-b border-slate-800/50 flex justify-between items-center">
                            <div>
                                <h1 className="text-3xl md:text-4xl font-black text-white italic tracking-tighter uppercase leading-none">
                                    {editingCategory ? t('edit') : t('new')}
                                </h1>
                                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px] mt-2 italic">{t('menuConfig')}</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl transition-all"
                            >
                                <CloseIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveCategory} className="p-10 md:p-12 space-y-10">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">{t('categoryName')}</label>
                                <input
                                    type="text"
                                    required
                                    value={newCategory.name}
                                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                                    className="w-full px-8 py-5 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-white uppercase italic tracking-tighter text-xl"
                                    placeholder="EJ. HAMBURGUESAS"
                                />
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">{t('iconRepresentation')}</label>
                                <div className="relative aspect-[21/9] rounded-[2rem] overflow-hidden bg-slate-950 border-2 border-dashed border-slate-800 group transition-all hover:border-emerald-500/50">
                                    {newCategory.image_url ? (
                                        <>
                                            <img src={newCategory.image_url} alt="Preview" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-sm">
                                                <label className="cursor-pointer bg-emerald-500 text-slate-900 px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all text-xs">
                                                    {t('changePhoto')}
                                                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
                                                </label>
                                            </div>
                                        </>
                                    ) : (
                                        <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-slate-900 transition-colors">
                                            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 border border-slate-700">
                                                {uploadingImage ? <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" /> : <ImageIcon className="w-8 h-8 text-slate-600" />}
                                            </div>
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{uploadingImage ? t('processing') : t('uploadRepresentativeImage')}</span>
                                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
                                        </label>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-6 pt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-6 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-[2rem] font-black uppercase tracking-widest transition-all active:scale-95 text-xs shadow-xl"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-[2] py-6 bg-emerald-500 text-slate-900 rounded-[2rem] font-black uppercase tracking-widest shadow-[0_10px_40px_rgba(16,185,129,0.3)] hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0 text-xs text-center"
                                >
                                    {saving ? t('saving') : (editingCategory ? t('confirmChanges') : t('createCategory'))}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
