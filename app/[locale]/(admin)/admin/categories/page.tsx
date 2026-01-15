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

    useEffect(() => {
        if (restaurantId) {
            loadCategories();
        }
    }, [restaurantId]);

    const loadCategories = async () => {
        if (!restaurantId) return;
        setLoading(true);
        const { data } = await adminSupabase
            .from('categories')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('sort_order', { ascending: true });

        if (data) setCategories(data);
        setLoading(false);
    };

    const handleSaveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!restaurantId) return;
        setSaving(true);

        if (editingCategory) {
            const { error } = await (adminSupabase.from('categories') as any)
                .update({
                    name: newCategory.name,
                    image_url: newCategory.image_url || null
                })
                .eq('id', editingCategory.id);

            if (!error) {
                setIsModalOpen(false);
                setEditingCategory(null);
                setNewCategory({ name: '', image_url: '' });
                loadCategories();
            }
        } else {
            const { error } = await adminSupabase.from('categories').insert({
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
        if (confirm('¿Estás seguro de eliminar esta categoría?')) {
            const { error } = await adminSupabase.from('categories').delete().eq('id', id);
            if (!error) loadCategories();
        }
    };

    const handleLogout = async () => {
        await adminSupabase.auth.signOut();
        router.push('/login');
    };

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
                    <h1 className="text-3xl md:text-4xl font-black text-secondary-900 tracking-tight">{t('categories')}</h1>
                    <p className="text-secondary-500 font-bold mt-1 text-sm md:text-base">Gestiona las categorías de tu menú.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingCategory(null);
                        setNewCategory({ name: '', image_url: '' });
                        setIsModalOpen(true);
                    }}
                    className="w-full md:w-auto flex items-center justify-center gap-3 bg-primary-500 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary-500/20 hover:-translate-y-1 transition-all active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    <span>Nueva Categoría</span>
                </button>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                {categories.map((category, idx) => (
                    <div
                        key={category.id}
                        className="bg-white rounded-[2rem] p-6 shadow-xl shadow-secondary-900/5 border border-secondary-100 group hover:-translate-y-1 transition-all duration-300 animate-scale-in"
                        style={{ animationDelay: `${idx * 50}ms` }}
                    >
                        <div className="relative w-full aspect-square rounded-[1.5rem] bg-secondary-50 mb-6 overflow-hidden flex items-center justify-center border border-secondary-100">
                            {category.image_url ? (
                                <img src={category.image_url} alt={category.name} className="w-full h-full object-cover" />
                            ) : (
                                <List className="w-12 h-12 text-secondary-200" />
                            )}
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                <button
                                    onClick={() => handleEditClick(category)}
                                    className="p-3 bg-white/90 backdrop-blur-sm text-secondary-600 rounded-xl hover:bg-primary-50 hover:text-primary-600 shadow-sm"
                                >
                                    <Pencil className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => handleDeleteCategory(category.id)}
                                    className="p-3 bg-white/90 backdrop-blur-sm text-red-500 rounded-xl hover:bg-red-50 shadow-sm"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <h3 className="text-xl font-black text-secondary-900 text-center">{category.name}</h3>
                    </div>
                ))}
            </div>

            {/* Add/Edit Category Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-secondary-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden animate-scale-in">
                        <div className="p-6 md:p-8 border-b border-secondary-50 flex justify-between items-center bg-secondary-50/30">
                            <h2 className="text-xl md:text-2xl font-black text-secondary-900 tracking-tight">
                                {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 md:p-3 hover:bg-white rounded-xl md:rounded-2xl transition-all shadow-sm border border-secondary-100"
                            >
                                <CloseIcon className="w-5 h-5 md:w-6 md:h-6 text-secondary-400" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveCategory} className="p-6 md:p-8 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-secondary-400 uppercase tracking-widest mb-2 px-2">Nombre</label>
                                <input
                                    type="text"
                                    required
                                    value={newCategory.name}
                                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                                    className="w-full px-6 py-4 bg-secondary-50 border border-secondary-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold text-secondary-900"
                                    placeholder="Ej: Hamburguesas"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-secondary-400 uppercase tracking-widest mb-2 px-2">URL de Imagen (Opcional)</label>
                                <input
                                    type="url"
                                    value={newCategory.image_url}
                                    onChange={(e) => setNewCategory({ ...newCategory, image_url: e.target.value })}
                                    className="w-full px-6 py-4 bg-secondary-50 border border-secondary-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold text-secondary-900"
                                    placeholder="https://ejemplo.com/imagen.jpg"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full py-5 bg-primary-500 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-primary-500/20 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0"
                            >
                                {saving ? 'Guardando...' : (editingCategory ? 'Guardar Cambios' : 'Crear Categoría')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
