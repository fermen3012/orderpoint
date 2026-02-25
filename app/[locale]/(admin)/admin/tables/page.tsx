'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from '@/i18n/routing';
import {
    Plus,
    Trash2,
    Pencil,
    X as CloseIcon,
    Utensils,
    Users,
    UserCircle,
    Loader2
} from 'lucide-react';

import { useAuth } from '@/components/auth/AuthContext';

export default function TablesPage() {
    const t = useTranslations('admin');
    const router = useRouter();
    const { restaurantId, userProfile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [tables, setTables] = useState<any[]>([]);
    const [staff, setStaff] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTable, setEditingTable] = useState<any | null>(null);
    const [newTable, setNewTable] = useState({ number: '', capacity: 2, waitress_id: '' });
    const [saving, setSaving] = useState(false);

    // Use the standard browser client to ensure session/cookies are sent
    const supabase = createClient();

    useEffect(() => {
        if (restaurantId) {
            loadData();
        }
    }, [restaurantId]);

    const loadData = async () => {
        if (!restaurantId) return;
        setLoading(true);
        try {
            const [tablesRes, staffRes] = await Promise.all([
                supabase
                    .from('tables')
                    .select('*, profiles:waitress_id(full_name)')
                    .eq('restaurant_id', restaurantId)
                    .order('number', { ascending: true }),
                supabase
                    .from('profiles')
                    .select('*')
                    .eq('restaurant_id', restaurantId)
                    .eq('role', 'mesera')
            ]);

            if (tablesRes.data) setTables(tablesRes.data);
            if (staffRes.data) setStaff(staffRes.data);
        } catch (error) {
            console.error('Error loading tables data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveTable = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!restaurantId) return;
        setSaving(true);

        try {
            const tableData = {
                number: newTable.number,
                capacity: newTable.capacity,
                waitress_id: newTable.waitress_id === '' ? null : newTable.waitress_id,
                restaurant_id: restaurantId
            };

            if (editingTable) {
                const { error } = await supabase
                    .from('tables')
                    .update(tableData)
                    .eq('id', editingTable.id);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('tables')
                    .insert([tableData]);

                if (error) throw error;
            }

            setIsModalOpen(false);
            setEditingTable(null);
            setNewTable({ number: '', capacity: 2, waitress_id: '' });
            loadData();
        } catch (error: any) {
            const errorMsg = error.message || 'Error desconocido';
            console.error('Error saving table:', error);
            alert('Error al guardar: ' + errorMsg);
        } finally {
            setSaving(false);
        }
    };

    const handleEditClick = (table: any) => {
        setEditingTable(table);
        setNewTable({
            number: table.number,
            capacity: table.capacity || 2,
            waitress_id: table.waitress_id || ''
        });
        setIsModalOpen(true);
    };

    const handleDeleteTable = async (id: string) => {
        if (confirm('¿Estás seguro de eliminar esta mesa?')) {
            const { error } = await supabase
                .from('tables')
                .delete()
                .eq('id', id);
            if (!error) loadData();
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 lg:p-10 pb-24 md:pb-10">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-secondary-900 tracking-tight">Mesas</h1>
                    <p className="text-secondary-500 font-bold mt-1 text-sm md:text-base">Gestiona el salón y la asignación de personal.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingTable(null);
                        setNewTable({ number: '', capacity: 2, waitress_id: '' });
                        setIsModalOpen(true);
                    }}
                    className="w-full md:w-auto flex items-center justify-center gap-3 bg-primary-500 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary-500/20 hover:-translate-y-1 transition-all active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    <span>Nueva Mesa</span>
                </button>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                {tables.map((table, idx) => (
                    <div
                        key={table.id}
                        className="bg-white rounded-[2rem] p-6 shadow-xl shadow-secondary-900/5 border border-secondary-100 group hover:-translate-y-1 transition-all duration-300 animate-scale-in"
                        style={{ animationDelay: `${idx * 50}ms` }}
                    >
                        <div className="flex items-start justify-between mb-6">
                            <div className="w-14 h-14 bg-secondary-50 rounded-2xl flex items-center justify-center border border-secondary-100 text-secondary-900 group-hover:bg-primary-50 group-hover:border-primary-100 group-hover:text-primary-600 transition-colors">
                                <Utensils className="w-7 h-7" />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleEditClick(table)}
                                    className="p-3 bg-secondary-50 text-secondary-400 rounded-xl hover:bg-primary-50 hover:text-primary-600 transition-colors"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDeleteTable(table.id)}
                                    className="p-3 bg-secondary-50 text-secondary-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-baseline gap-1 mb-1">
                                <span className="text-3xl font-black text-secondary-900 tracking-tighter italic">#{table.number}</span>
                            </div>

                            <div className="space-y-2 mt-4">
                                <div className="flex items-center gap-2 text-secondary-500 font-bold text-sm">
                                    <Users className="w-4 h-4 text-secondary-300" />
                                    <span>Capacidad: {table.capacity}</span>
                                </div>
                                <div className="flex items-center gap-2 text-secondary-500 font-bold text-sm">
                                    <UserCircle className="w-4 h-4 text-secondary-300" />
                                    <span className={table.profiles?.full_name ? 'text-primary-600' : 'text-slate-400'}>
                                        {table.profiles?.full_name || 'Sin asignar'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {tables.length === 0 && (
                    <div className="col-span-full py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-secondary-100 flex flex-col items-center justify-center text-center">
                        <div className="w-20 h-20 bg-secondary-50 rounded-3xl flex items-center justify-center mb-4">
                            <Utensils className="w-10 h-10 text-secondary-200" />
                        </div>
                        <h3 className="text-xl font-black text-secondary-900 mb-2">No hay mesas configuradas</h3>
                        <p className="text-secondary-400 font-bold max-w-xs">Comienza agregando las mesas de tu salón para que el personal pueda tomar pedidos.</p>
                    </div>
                )}
            </div>

            {/* Add/Edit Table Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-secondary-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in">
                        <div className="p-8 border-b border-secondary-50 flex justify-between items-center bg-secondary-50/30">
                            <h2 className="text-2xl font-black text-secondary-900 tracking-tight">
                                {editingTable ? 'Editar Mesa' : 'Nueva Mesa'}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm border border-secondary-100"
                            >
                                <CloseIcon className="w-6 h-6 text-secondary-400" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveTable} className="p-8 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-secondary-400 uppercase tracking-widest mb-2 px-2">Número / Nombre de Mesa</label>
                                <input
                                    type="text"
                                    required
                                    value={newTable.number}
                                    onChange={(e) => setNewTable({ ...newTable, number: e.target.value })}
                                    className="w-full px-6 py-4 bg-secondary-50 border border-secondary-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold text-secondary-900"
                                    placeholder="Ej: 1 o VIP-01"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-secondary-400 uppercase tracking-widest mb-2 px-2">Capacidad</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={newTable.capacity || ''}
                                        onChange={(e) => {
                                            const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                            setNewTable({ ...newTable, capacity: val });
                                        }}
                                        className="w-full px-6 py-4 bg-secondary-50 border border-secondary-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold text-secondary-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-secondary-400 uppercase tracking-widest mb-2 px-2">Mesera (Opcional)</label>
                                    <select
                                        value={newTable.waitress_id}
                                        onChange={(e) => setNewTable({ ...newTable, waitress_id: e.target.value })}
                                        className="w-full px-6 py-4 bg-secondary-50 border border-secondary-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold text-secondary-900 appearance-none bg-no-repeat bg-[right_1.5rem_center] bg-[length:1rem_1rem]"
                                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='y19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")` }}
                                    >
                                        <option value="">Sin asignar</option>
                                        {staff.map(s => (
                                            <option key={s.id} value={s.id}>{s.full_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full py-5 bg-primary-500 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-primary-500/20 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0"
                            >
                                {saving ? 'Guardando...' : (editingTable ? 'Guardar Cambios' : 'Crear Mesa')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
