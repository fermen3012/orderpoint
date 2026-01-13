'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { adminSupabase } from '@/lib/supabase/admin-client';
import { useRouter } from '@/i18n/routing';
import {
    LayoutDashboard,
    ShoppingBag,
    LogOut,
    Package,
    List,
    Plus,
    Trash2,
    Pencil,
    X as CloseIcon,
    Search,
    ChefHat
} from 'lucide-react';
import { SidebarLink } from '../dashboard/page';

import { useAuth } from '@/components/auth/AuthContext';

export default function IngredientsPage() {
    const t = useTranslations('admin');
    const router = useRouter();
    const { restaurantId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [ingredients, setIngredients] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIngredient, setEditingIngredient] = useState<any | null>(null);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [newName, setNewName] = useState('');

    useEffect(() => {
        if (restaurantId) {
            loadIngredients();
        }
    }, [restaurantId]);

    const loadIngredients = async () => {
        if (!restaurantId) return;
        setLoading(true);
        const { data } = await adminSupabase
            .from('ingredients')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('name', { ascending: true });

        if (data) setIngredients(data);
        setLoading(false);
    };

    const handleSaveIngredient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!restaurantId) return;
        setSaving(true);

        if (editingIngredient) {
            const { error } = await (adminSupabase.from('ingredients') as any)
                .update({ name: newName })
                .eq('id', editingIngredient.id);

            if (!error) {
                setIsModalOpen(false);
                setEditingIngredient(null);
                setNewName('');
                loadIngredients();
            }
        } else {
            const { error } = await (adminSupabase.from('ingredients') as any).insert({
                name: newName,
                restaurant_id: restaurantId
            });

            if (!error) {
                setIsModalOpen(false);
                setNewName('');
                loadIngredients();
            }
        }
        setSaving(false);
    };

    const handleEditClick = (ingredient: any) => {
        setEditingIngredient(ingredient);
        setNewName(ingredient.name);
        setIsModalOpen(true);
    };

    const handleDeleteIngredient = async (id: string) => {
        if (confirm('¿Estás seguro de eliminar este ingrediente?')) {
            const { error } = await adminSupabase.from('ingredients').delete().eq('id', id);
            if (!error) loadIngredients();
        }
    };

    const handleLogout = async () => {
        await adminSupabase.auth.signOut();
        router.push('/login');
    };

    const filteredIngredients = ingredients.filter(i =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase())
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
                        onClick={() => router.push('/admin/products')}
                    />
                    <SidebarLink
                        icon={<List className="w-5 h-5" />}
                        label={t('categories')}
                        onClick={() => router.push('/admin/categories')}
                    />
                    <SidebarLink
                        icon={<ChefHat className="w-5 h-5" />}
                        label="Ingredientes"
                        active
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
                        <h1 className="text-4xl font-black text-secondary-900 tracking-tight">Ingredientes</h1>
                        <p className="text-secondary-500 font-bold mt-1">Gestiona los ingredientes que los clientes pueden quitar.</p>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                            <input
                                type="text"
                                placeholder="Buscar ingrediente..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-14 pr-6 py-4 bg-white border border-secondary-100 rounded-[1.5rem] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-bold shadow-sm"
                            />
                        </div>
                        <button
                            onClick={() => {
                                setEditingIngredient(null);
                                setNewName('');
                                setIsModalOpen(true);
                            }}
                            className="flex items-center gap-3 bg-primary-500 text-white px-8 py-4 rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-primary-500/20 hover:-translate-y-1 transition-all active:scale-95 whitespace-nowrap"
                        >
                            <Plus className="w-5 h-5" />
                            <span>Nuevo Ingrediente</span>
                        </button>
                    </div>
                </header>

                <div className="bg-white rounded-[2.5rem] shadow-xl shadow-secondary-900/5 border border-secondary-100 overflow-hidden animate-slide-up">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-secondary-50/50 text-secondary-400 text-xs uppercase font-black tracking-widest">
                                <tr>
                                    <th className="px-8 py-5">Nombre del Ingrediente</th>
                                    <th className="px-8 py-5">Fecha de Creación</th>
                                    <th className="px-8 py-5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-secondary-50">
                                {filteredIngredients.map((ingredient) => (
                                    <tr key={ingredient.id} className="hover:bg-secondary-50/30 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-secondary-50 flex items-center justify-center border border-secondary-100">
                                                    <ChefHat className="w-5 h-5 text-secondary-400" />
                                                </div>
                                                <p className="font-black text-secondary-900">{ingredient.name}</p>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-secondary-500 font-bold">
                                            {new Date(ingredient.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleEditClick(ingredient)}
                                                    className="p-3 text-secondary-300 hover:text-primary-600 hover:bg-primary-50 rounded-2xl transition-all"
                                                >
                                                    <Pencil className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteIngredient(ingredient.id)}
                                                    className="p-3 text-secondary-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredIngredients.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-8 py-12 text-center text-secondary-400 font-bold">
                                            No se encontraron ingredientes.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Add/Edit Ingredient Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-secondary-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-scale-in">
                            <div className="p-8 border-b border-secondary-50 flex justify-between items-center bg-secondary-50/30">
                                <h2 className="text-2xl font-black text-secondary-900 tracking-tight">
                                    {editingIngredient ? 'Editar Ingrediente' : 'Nuevo Ingrediente'}
                                </h2>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm border border-secondary-100"
                                >
                                    <CloseIcon className="w-6 h-6 text-secondary-400" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveIngredient} className="p-8 space-y-6">
                                <div>
                                    <label className="block text-xs font-black text-secondary-400 uppercase tracking-widest mb-2 px-2">Nombre del Ingrediente</label>
                                    <input
                                        type="text"
                                        required
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        className="w-full px-6 py-4 bg-secondary-50 border border-secondary-100 rounded-[1.5rem] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-bold"
                                        placeholder="Ej: Cebolla, Pepinillos, etc."
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="w-full py-5 bg-primary-500 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-primary-500/20 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0"
                                >
                                    {saving ? 'Guardando...' : (editingIngredient ? 'Guardar Cambios' : 'Crear Ingrediente')}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
