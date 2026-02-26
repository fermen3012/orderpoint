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
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Cargando Ingredientes...</p>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-8 h-1 bg-emerald-500 rounded-full"></span>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Gestión de Atributos</span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        Ingredientes
                    </h1>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-6 w-full xl:w-auto">
                    <div className="relative group flex-1 xl:w-80">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="FILTRAR POR NOMBRE..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-16 pr-8 py-5 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-3xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-white text-xs uppercase tracking-widest"
                        />
                    </div>
                    <button
                        onClick={() => {
                            setEditingIngredient(null);
                            setNewName('');
                            setIsModalOpen(true);
                        }}
                        className="group relative flex items-center justify-center gap-3 px-10 py-5 bg-emerald-500 text-slate-900 rounded-[2rem] font-black uppercase tracking-widest shadow-[0_10px_25px_rgba(16,185,129,0.3)] hover:-translate-y-1 transition-all active:scale-95 whitespace-nowrap"
                    >
                        <Plus className="w-6 h-6" />
                        <span>Añadir Nuevo</span>
                    </button>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block bg-slate-900/40 backdrop-blur-sm rounded-[3.5rem] border border-slate-800 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full">
                        <thead className="bg-slate-950/20 border-b border-slate-800/50">
                            <tr>
                                <th className="px-12 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-left">Especificación del Ingrediente</th>
                                <th className="px-12 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-left">Registro de Sistema</th>
                                <th className="px-12 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-right">Controles</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {filteredIngredients.map((ingredient, idx) => (
                                <tr key={ingredient.id} className="group hover:bg-slate-800/20 transition-all duration-300">
                                    <td className="px-12 py-8">
                                        <div className="flex items-center gap-6">
                                            <div className="w-14 h-14 rounded-[1.25rem] bg-slate-950 flex items-center justify-center border border-slate-800 group-hover:border-emerald-500/30 transition-all duration-500 shadow-xl">
                                                <ChefHat className="w-7 h-7 text-slate-700 group-hover:text-emerald-500 transition-colors" />
                                            </div>
                                            <div>
                                                <p className="font-black text-white text-xl italic tracking-tighter uppercase group-hover:text-emerald-500 transition-colors">
                                                    {ingredient.name}
                                                </p>
                                                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-1">ID: {ingredient.id.substring(0, 8)}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-12 py-8">
                                        <div className="flex items-center gap-2 text-slate-500 group-hover:text-slate-300 transition-colors">
                                            <Calendar className="w-4 h-4" />
                                            <span className="font-black text-xs uppercase tracking-widest">
                                                {new Date(ingredient.created_at).toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-12 py-8">
                                        <div className="flex justify-end gap-3 translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                            <button
                                                onClick={() => handleEditClick(ingredient)}
                                                className="p-4 bg-slate-800 hover:bg-emerald-500 text-slate-400 hover:text-slate-900 rounded-2xl transition-all shadow-xl"
                                            >
                                                <Pencil className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteIngredient(ingredient.id)}
                                                className="p-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl transition-all border border-red-500/20 shadow-xl"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredIngredients.length === 0 && (
                        <div className="p-32 text-center">
                            <ChefHat className="w-16 h-16 text-slate-800 mx-auto mb-6" />
                            <h2 className="text-2xl font-black text-slate-700 uppercase italic tracking-tighter">Sin Resultados Encontrados</h2>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-6">
                {filteredIngredients.map((ingredient) => (
                    <div key={ingredient.id} className="bg-slate-900/50 backdrop-blur-md p-8 rounded-[3rem] border border-slate-800 relative group overflow-hidden">
                        <div className="flex items-center gap-5 mb-8">
                            <div className="w-16 h-16 rounded-[1.5rem] bg-slate-950 flex items-center justify-center border border-slate-800 shadow-xl flex-shrink-0">
                                <ChefHat className="w-8 h-8 text-emerald-500/50" />
                            </div>
                            <div>
                                <h3 className="font-black text-white text-2xl italic tracking-tighter uppercase leading-tight group-hover:text-emerald-500 transition-colors">
                                    {ingredient.name}
                                </h3>
                                <div className="flex items-center gap-1.5 mt-1 text-slate-600">
                                    <Calendar className="w-3 h-3" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">{new Date(ingredient.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => handleEditClick(ingredient)}
                                className="flex-1 py-4 bg-slate-800 text-slate-400 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg"
                            >
                                <Pencil className="w-4 h-4" />
                                Editar
                            </button>
                            <button
                                onClick={() => handleDeleteIngredient(ingredient.id)}
                                className="flex-1 py-4 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg border border-red-500/20"
                            >
                                <Trash2 className="w-4 h-4" />
                                Borrar
                            </button>
                        </div>
                    </div>
                ))}

                {filteredIngredients.length === 0 && (
                    <div className="p-20 text-center bg-slate-900/20 rounded-[3rem] border border-dashed border-slate-800">
                        <Search className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                        <p className="font-black text-slate-600 uppercase tracking-widest text-xs">No hay coincidencias.</p>
                    </div>
                )}
            </div>

            {/* Modal Redesign */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-500">
                    <div className="bg-slate-900 w-full max-w-xl rounded-[3rem] border border-slate-800 shadow-2xl relative animate-in zoom-in-95 duration-300">
                        <div className="p-10 md:p-12 border-b border-slate-800/50 flex justify-between items-center bg-slate-900/50 backdrop-blur-md rounded-t-[3rem]">
                            <div>
                                <h1 className="text-3xl md:text-4xl font-black text-white italic tracking-tighter uppercase leading-none">
                                    {editingIngredient ? 'Editar' : 'Nuevo'}
                                </h1>
                                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px] mt-2 italic">Registro de Componentes</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl transition-all"
                            >
                                <CloseIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveIngredient} className="p-10 md:p-12 space-y-10">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Denominación del Ingrediente</label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="w-full px-8 py-6 bg-slate-950 border border-slate-800 rounded-[2rem] focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-white uppercase italic tracking-tighter text-2xl shadow-inner placeholder:text-slate-800"
                                    placeholder="EJ: CEBOLLA MORADA"
                                />
                            </div>

                            <div className="flex flex-col sm:flex-row gap-6 pt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-6 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-[2rem] font-black uppercase tracking-widest transition-all active:scale-95 text-xs shadow-xl"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-[2] py-6 bg-emerald-500 text-slate-900 rounded-[2rem] font-black uppercase tracking-widest shadow-[0_10px_40px_rgba(16,185,129,0.3)] hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 text-xs text-center"
                                >
                                    {saving ? 'Procesando...' : (editingIngredient ? 'Confirmar Ajuste' : 'Registrar Ingrediente')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
