'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/browser';
import { saveTableAction, deleteTableAction } from '@/actions/tables';
import {
    Plus,
    Trash2,
    Pencil,
    X as CloseIcon,
    Utensils,
    Users,
    Loader2,
    RefreshCw,
    AlertTriangle
} from 'lucide-react';

import { useAuth } from '@/components/auth/AuthContext';

export default function TablesPage() {
    const t = useTranslations('admin');
    const { restaurantId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [tables, setTables] = useState<any[]>([]);
    
    // Add/Edit Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTable, setEditingTable] = useState<any | null>(null);
    const [newTable, setNewTable] = useState({ number: '', capacity: 2 });
    const [saving, setSaving] = useState(false);

    // Delete Confirmation Modal
    const [tableToDelete, setTableToDelete] = useState<any | null>(null);
    const [deleting, setDeleting] = useState(false);

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
            const { data, error } = await (supabase.from('tables') as any)
                .select('*')
                .eq('restaurant_id', restaurantId)
                .order('number', { ascending: true });

            if (error) throw error;
            if (data) setTables(data);
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
            const res = await saveTableAction({
                id: editingTable?.id,
                number: newTable.number,
                capacity: newTable.capacity,
                waitress_id: null,
                restaurantId
            });

            if (!res.success) {
                if (res.error === 'DUPLICATE_NUMBER') {
                    alert(t('tableAlreadyExists'));
                } else {
                    alert(t('errorSave', { error: res.error || 'Error' }));
                }
                return;
            }

            setIsModalOpen(false);
            setEditingTable(null);
            setNewTable({ number: '', capacity: 2 });
            await loadData();
        } catch (error: any) {
            const errorMsg = error.message || 'Error desconocido';
            console.error('Error saving table:', error);
            alert(t('errorSave', { error: errorMsg }));
        } finally {
            setSaving(false);
        }
    };

    const handleEditClick = (table: any) => {
        setEditingTable(table);
        setNewTable({
            number: table.number,
            capacity: table.capacity || 2
        });
        setIsModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!tableToDelete || !restaurantId) return;

        setDeleting(true);
        try {
            const res = await deleteTableAction(tableToDelete.id, restaurantId);
            if (!res.success) {
                alert(t('errorDeleteTable', { error: res.error || 'Error' }));
                return;
            }
            setTableToDelete(null);
            await loadData();
        } catch (error: any) {
            console.error('Error deleting table:', error);
            alert(t('errorDeleteTable', { error: error.message || 'Error desconocido' }));
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">{t('loadingData')}</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 lg:p-10 pb-32">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-8 h-1 bg-emerald-500 rounded-full"></span>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">{t('distribution')}</span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        {t('salonTables')}
                    </h1>
                    <p className="text-slate-400 font-bold mt-3 text-[10px] uppercase tracking-widest">
                        {t('manageSalonDesc')}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="px-6 py-4 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-lg"
                        title={t('update')}
                    >
                        <RefreshCw className="w-4 h-4" />
                        <span>{t('update')}</span>
                    </button>

                    <button
                        onClick={() => {
                            setEditingTable(null);
                            setNewTable({ number: '', capacity: 2 });
                            setIsModalOpen(true);
                        }}
                        className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-[0_8px_25px_rgba(16,185,129,0.35)] hover:-translate-y-0.5 transition-all active:scale-95"
                    >
                        <Plus className="w-4 h-4 stroke-[3px]" />
                        <span>{t('newTable')}</span>
                    </button>
                </div>
            </header>

            {/* Grid de Mesas con el diseño visual exacto de Exo Server */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                {tables.map((table) => (
                    <div
                        key={table.id}
                        className="aspect-square p-5 rounded-[32px] border-2 border-emerald-500/80 bg-gradient-to-br from-emerald-950/50 via-slate-900 to-teal-950/60 shadow-[0_0_25px_rgba(16,185,129,0.35)] hover:shadow-[0_0_35px_rgba(16,185,129,0.55)] hover:border-emerald-400 transition-all duration-300 relative overflow-hidden group flex flex-col items-center justify-between"
                    >
                        {/* Ambient glow highlight (igual a Exo Server) */}
                        <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl pointer-events-none bg-emerald-500/25 group-hover:bg-emerald-500/35 transition-all" />

                        {/* Top row: Icon and Action Buttons */}
                        <div className="w-full flex items-center justify-between relative z-10">
                            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-gradient-to-tr from-emerald-600 to-teal-400 shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-transform group-hover:scale-105">
                                <Utensils className="w-5 h-5 text-white" />
                            </div>

                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => handleEditClick(table)}
                                    className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-all active:scale-90 shadow-md"
                                    title={t('edit')}
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => setTableToDelete(table)}
                                    className="p-2 rounded-xl bg-red-950/80 hover:bg-red-900/90 text-red-400 hover:text-red-300 border border-red-500/40 transition-all active:scale-90 shadow-md shadow-red-950/50"
                                    title={t('delete')}
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Center: Table Number */}
                        <div className="text-center relative z-10 my-auto">
                            <span className="block text-3xl sm:text-4xl font-black italic tracking-tighter leading-none text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                                #{table.number}
                            </span>
                        </div>

                        {/* Bottom row: Capacity Badge */}
                        <div className="w-full text-center relative z-10">
                            <span className="inline-flex items-center justify-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-emerald-300 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-500/40 shadow-sm">
                                <Users className="w-3 h-3 text-emerald-400" />
                                {t('capacity', { count: table.capacity })}
                            </span>
                        </div>
                    </div>
                ))}

                {tables.length === 0 && (
                    <div className="col-span-full py-20 bg-slate-900/30 rounded-[32px] border-2 border-dashed border-slate-800 flex flex-col items-center justify-center text-center p-6">
                        <div className="w-20 h-20 bg-slate-800/60 rounded-3xl flex items-center justify-center mb-4 border border-slate-700">
                            <Utensils className="w-10 h-10 text-slate-500" />
                        </div>
                        <h3 className="text-xl font-black text-white italic uppercase mb-2">{t('noTablesConfigured')}</h3>
                        <p className="text-slate-500 font-bold text-xs max-w-xs">{t('noTablesDesc')}</p>
                    </div>
                )}
            </div>

            {/* Modal de Creación / Edición de Mesa */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-slate-900 w-full max-w-md rounded-[32px] border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative">
                        <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-955">
                            <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">
                                {editingTable ? t('editTable') : t('newTable')}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-2xl transition-all border border-slate-800"
                            >
                                <CloseIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveTable} className="p-8 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                                    {t('tableNameOrNumber')}
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={newTable.number}
                                    onChange={(e) => setNewTable({ ...newTable, number: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-955 border border-slate-800 rounded-2xl focus:border-emerald-500 outline-none transition-all font-black text-white text-sm"
                                    placeholder={t('placeholderTableName')}
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                                    {t('capacityLabel')}
                                </label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={newTable.capacity || ''}
                                    onChange={(e) => {
                                        const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                        setNewTable({ ...newTable, capacity: val });
                                    }}
                                    className="w-full px-5 py-4 bg-slate-955 border border-slate-800 rounded-2xl focus:border-emerald-500 outline-none transition-all font-black text-white text-sm"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl font-black uppercase tracking-widest shadow-[0_8px_25px_rgba(16,185,129,0.35)] hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0"
                            >
                                {saving ? t('saving') : (editingTable ? t('confirmChanges') : t('newTable'))}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Confirmación de Borrado */}
            {tableToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/85 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-slate-900 w-full max-w-md rounded-[32px] border border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.2)] p-8 relative overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Ambient glow highlight rojo */}
                        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl bg-red-500/20 pointer-events-none" />

                        {/* Icono central de advertencia */}
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-400 shadow-[0_0_20px_rgba(239,68,68,0.5)] flex items-center justify-center mx-auto mb-5 text-white">
                            <AlertTriangle className="w-8 h-8 stroke-[2.5px]" />
                        </div>

                        {/* Título y descripción */}
                        <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase text-center">
                            {t('deleteTableModalTitle')}
                        </h3>
                        <p className="text-slate-300 text-xs font-bold text-center mt-3 leading-relaxed">
                            {t('deleteTableModalDesc', { number: tableToDelete.number })}
                        </p>

                        {/* Botones de acción inferiores */}
                        <div className="flex items-center gap-3 mt-8">
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={() => setTableToDelete(null)}
                                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 border border-slate-700/80 disabled:opacity-50"
                            >
                                {t('cancel')}
                            </button>

                            <button
                                type="button"
                                disabled={deleting}
                                onClick={confirmDelete}
                                className="flex-1 py-4 bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-[0_8px_25px_rgba(239,68,68,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {deleting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>{t('processing')}</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-4 h-4" />
                                        <span>{t('confirmDeleteBtn')}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
