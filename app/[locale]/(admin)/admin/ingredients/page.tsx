'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/browser';
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
    ChefHat,
    Calendar
} from 'lucide-react';
import { SidebarLink } from '@/components/admin/SidebarLink';

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
        const supabase = createClient();
        const { data } = await (supabase
            .from('ingredients' as any) as any)
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

        const supabase = createClient();

        if (editingIngredient) {
            const { error } = await (supabase
                .from('ingredients' as any) as any)
                .update({ name: newName })
                .eq('id', editingIngredient.id);

            if (!error) {
                setIsModalOpen(false);
                setEditingIngredient(null);
                setNewName('');
                loadIngredients();
            }
        } else {
            const { error } = await (supabase
                .from('ingredients' as any) as any)
                .insert({
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
            const supabase = createClient();
            const { error } = await (supabase.from('ingredients' as any) as any).delete().eq('id', id);
            if (!error) loadIngredients();
        }
    };

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
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
        <div className="p-4 md:p-8 lg:p-10 pb-20 md:pb-10">
            <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-10">
                <div className="w-full xl:w-auto">
                    <h1 className="text-3xl md:text-4xl font-black text-secondary-900 tracking-tight">Ingredientes</h1>
                    <p className="text-secondary-500 font-bold mt-1 text-sm md:text-base">Gestiona los ingredientes que los clientes pueden quitar.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full xl:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                        <input
                            type="text"
                            placeholder="Buscar ingrediente..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-14 pr-6 py-4 bg-white border border-secondary-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold text-secondary-900 shadow-sm"
                        />
                    </div>
                    <button
                        onClick={() => {
                            setEditingIngredient(null);
                            setNewName('');
                            setIsModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-3 bg-primary-500 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary-500/20 hover:-translate-y-1 transition-all active:scale-95 whitespace-nowrap"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Nuevo Ingrediente</span>
                    </button>
                </div>
            </header>

            {/* Mobile Card View */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
                {filteredIngredients.map((ingredient) => (
                    <div key={ingredient.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-secondary-100 relative group">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-secondary-50 flex items-center justify-center border border-secondary-100">
                                    <ChefHat className="w-6 h-6 text-secondary-400" />
                                </div>
                                <div>
                                    <h3 className="font-black text-secondary-900 text-lg leading-tight">{ingredient.name}</h3>
                                    <div className="flex items-center gap-1.5 mt-1 text-secondary-400">
                                        <Calendar className="w-3 h-3" />
                                        <span className="text-xs font-bold">{new Date(ingredient.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 mt-4">
                            <button
                                onClick={() => handleEditClick(ingredient)}
                                className="flex-1 py-3 bg-secondary-50 text-secondary-600 hover:bg-primary-50 hover:text-primary-600 rounded-xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-wider transition-colors"
                            >
                                <Pencil className="w-4 h-4" />
                                Editar
                            </button>
                            <button
                                onClick={() => handleDeleteIngredient(ingredient.id)}
                                className="flex-1 py-3 bg-secondary-50 text-secondary-600 hover:bg-red-50 hover:text-red-500 rounded-xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-wider transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Eliminar
                            </button>
                        </div>
                    </div>
                ))}
                {filteredIngredients.length === 0 && (
                    <div className="bg-white p-10 rounded-3xl text-center border border-secondary-100">
                        <ChefHat className="w-12 h-12 text-secondary-200 mx-auto mb-4" />
                        <p className="font-bold text-secondary-400">No se encontraron ingredientes.</p>
                    </div>
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-xl shadow-secondary-900/5 border border-secondary-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-secondary-50/50 text-secondary-400 text-[10px] md:text-xs uppercase font-black tracking-widest">
                            <tr>
                                <th className="px-6 md:px-8 py-4 md:py-5">Nombre del Ingrediente</th>
                                <th className="px-6 md:px-8 py-4 md:py-5">Fecha de Creación</th>
                                <th className="px-6 md:px-8 py-4 md:py-5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary-50">
                            {filteredIngredients.map((ingredient) => (
                                <tr key={ingredient.id} className="hover:bg-secondary-50/30 transition-colors group">
                                    <td className="px-6 md:px-8 py-4 md:py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-secondary-50 flex items-center justify-center border border-secondary-100">
                                                <ChefHat className="w-5 h-5 text-secondary-400" />
                                            </div>
                                            <p className="font-black text-secondary-900">{ingredient.name}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 md:px-8 py-4 md:py-6 text-secondary-500 font-bold text-sm">
                                        {new Date(ingredient.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 md:px-8 py-4 md:py-6 text-right">
                                        <div className="flex justify-end gap-1 md:gap-2">
                                            <button
                                                onClick={() => handleEditClick(ingredient)}
                                                className="p-3 text-secondary-300 hover:text-primary-600 hover:bg-primary-50 rounded-xl md:rounded-2xl transition-all"
                                            >
                                                <Pencil className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteIngredient(ingredient.id)}
                                                className="p-3 text-secondary-300 hover:text-red-500 hover:bg-red-50 rounded-xl md:rounded-2xl transition-all"
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
                    <div className="bg-white w-full max-w-md rounded-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden animate-scale-in">
                        <div className="p-6 md:p-8 border-b border-secondary-50 flex justify-between items-center bg-secondary-50/30">
                            <h2 className="text-xl md:text-2xl font-black text-secondary-900 tracking-tight">
                                {editingIngredient ? 'Editar Ingrediente' : 'Nuevo Ingrediente'}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 md:p-3 hover:bg-white rounded-xl md:rounded-2xl transition-all shadow-sm border border-secondary-100"
                            >
                                <CloseIcon className="w-5 h-5 md:w-6 md:h-6 text-secondary-400" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveIngredient} className="p-6 md:p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-secondary-400 uppercase tracking-widest mb-1 px-2">Nombre del Ingrediente</label>
                                <input
                                    type="text"
                                    required
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="w-full px-6 py-4 bg-secondary-50 border border-secondary-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold text-secondary-900"
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
        </div>
    );
}
