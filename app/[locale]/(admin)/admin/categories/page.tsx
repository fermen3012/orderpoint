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
import { SidebarLink } from '../dashboard/page';

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
                        onClick={() => router.push('/admin/products')}
                    />
                    <SidebarLink
                        icon={<List className="w-5 h-5" />}
                        label={t('categories')}
                        active
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
                        <h1 className="text-4xl font-black text-secondary-900 tracking-tight">{t('categories')}</h1>
                        <p className="text-secondary-500 font-bold mt-1">Gestiona las categorías de tu menú.</p>
                    </div>
                    <button
                        onClick={() => {
                            setEditingCategory(null);
                            setNewCategory({ name: '', image_url: '' });
                            setIsModalOpen(true);
                        }}
                        className="flex items-center gap-3 bg-primary-500 text-white px-8 py-4 rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-primary-500/20 hover:-translate-y-1 transition-all active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Nueva Categoría</span>
                    </button>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {categories.map((category, idx) => (
                        <div
                            key={category.id}
                            className="bg-white rounded-[2.5rem] p-6 shadow-xl shadow-secondary-900/5 border border-secondary-100 group hover:-translate-y-1 transition-all duration-300 animate-scale-in"
                            style={{ animationDelay: `${idx * 50}ms` }}
                        >
                            <div className="relative w-full aspect-square rounded-[2rem] bg-secondary-50 mb-6 overflow-hidden flex items-center justify-center border border-secondary-100">
                                {category.image_url ? (
                                    <img src={category.image_url} alt={category.name} className="w-full h-full object-cover" />
                                ) : (
                                    <List className="w-12 h-12 text-secondary-200" />
                                )}
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                    <button
                                        onClick={() => handleEditClick(category)}
                                        className="p-3 bg-white/90 backdrop-blur-sm text-secondary-600 rounded-2xl hover:bg-primary-50 hover:text-primary-600 shadow-sm"
                                    >
                                        <Pencil className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteCategory(category.id)}
                                        className="p-3 bg-white/90 backdrop-blur-sm text-red-500 rounded-2xl hover:bg-red-50 shadow-sm"
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
                        <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-scale-in">
                            <div className="p-8 border-b border-secondary-50 flex justify-between items-center bg-secondary-50/30">
                                <h2 className="text-2xl font-black text-secondary-900 tracking-tight">
                                    {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
                                </h2>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm border border-secondary-100"
                                >
                                    <CloseIcon className="w-6 h-6 text-secondary-400" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveCategory} className="p-8 space-y-6">
                                <div>
                                    <label className="block text-xs font-black text-secondary-400 uppercase tracking-widest mb-2 px-2">Nombre</label>
                                    <input
                                        type="text"
                                        required
                                        value={newCategory.name}
                                        onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                                        className="w-full px-6 py-4 bg-secondary-50 border border-secondary-100 rounded-[1.5rem] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-bold"
                                        placeholder="Ej: Hamburguesas"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-secondary-400 uppercase tracking-widest mb-2 px-2">URL de Imagen (Opcional)</label>
                                    <input
                                        type="url"
                                        value={newCategory.image_url}
                                        onChange={(e) => setNewCategory({ ...newCategory, image_url: e.target.value })}
                                        className="w-full px-6 py-4 bg-secondary-50 border border-secondary-100 rounded-[1.5rem] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-bold"
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
            </main>
        </div>
    );
}
