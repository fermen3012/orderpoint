'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from '@/i18n/routing';
import {
    Users,
    UserPlus,
    Trash2,
    Edit2,
    LayoutDashboard,
    ShoppingBag,
    Package,
    List,
    LogOut,
    Mail,
    Lock,
    Loader2,
    X as CloseIcon,
    ChefHat,
    Store
} from 'lucide-react';
import { SidebarLink } from '@/components/admin/SidebarLink';
import { getStaffUsers, createStaffUser, deleteStaffUser, updateStaffUser } from '@/lib/actions/users';

import { useAuth } from '@/components/auth/AuthContext';

export default function UsersPage() {
    const t = useTranslations('admin');
    const router = useRouter();
    const { userProfile, restaurantId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [restaurants, setRestaurants] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const supabase = createClient();

    useEffect(() => {
        if (userProfile) {
            loadData();
        }
    }, [userProfile]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [usersData, restData] = await Promise.all([
                getStaffUsers(),
                userProfile?.is_super_admin
                    ? (supabase.from('restaurants' as any) as any).select('*')
                    : Promise.resolve({ data: [] })
            ]);
            setUsers(usersData);
            setRestaurants(restData.data || []);
        } catch (err) {
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setCreating(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        let result;

        if (editingUser) {
            result = await updateStaffUser(editingUser.id, formData);
        } else {
            result = await createStaffUser(formData);
        }

        if (result.error) {
            setError(result.error);
            setCreating(false);
        } else {
            setShowModal(false);
            setEditingUser(null);
            loadData();
            setCreating(false);
        }
    };

    const handleEdit = (user: any) => {
        setEditingUser(user);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingUser(null);
        setError(null);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
        const result = await deleteStaffUser(id);
        if (!result.error) {
            loadData();
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Cargando Personal...</p>
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
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Gestión de Accesos</span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        Personal
                    </h1>
                </div>

                <button
                    onClick={() => {
                        setEditingUser(null);
                        setShowModal(true);
                    }}
                    className="group relative flex items-center justify-center gap-3 px-10 py-4 bg-emerald-500 text-slate-900 rounded-2xl font-black uppercase tracking-widest shadow-[0_10px_20px_rgba(16,185,129,0.2)] hover:-translate-y-1 transition-all active:scale-95 w-full lg:w-auto"
                >
                    <UserPlus className="w-6 h-6" />
                    <span>Añadir Miembro</span>
                </button>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block bg-slate-900/40 backdrop-blur-sm rounded-[3rem] border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full">
                        <thead className="bg-slate-950/20">
                            <tr>
                                <th className="px-10 py-8 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">Nombre del Usuario</th>
                                <th className="px-10 py-8 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">Correo Electrónico</th>
                                <th className="px-10 py-8 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">Rol Asignado</th>
                                <th className="px-10 py-8 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">Sede / Restaurante</th>
                                <th className="px-10 py-8 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {users.map((profile) => (
                                <tr key={profile.id} className="group hover:bg-slate-800/20 transition-all duration-300">
                                    <td className="px-10 py-8">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center font-black text-emerald-500 border border-slate-700">
                                                {profile.full_name?.charAt(0) || 'U'}
                                            </div>
                                            <span className="font-black text-white text-lg italic tracking-tighter uppercase">
                                                {profile.full_name}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-10 py-8">
                                        <div className="flex items-center gap-2 text-slate-400 group-hover:text-slate-300 transition-colors">
                                            <Mail className="w-4 h-4" />
                                            <span className="font-bold text-sm tracking-tight">{profile.email || '—'}</span>
                                        </div>
                                    </td>
                                    <td className="px-10 py-8">
                                        <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-lg border ${profile.role === 'admin' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                            profile.role === 'kitchen' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                                profile.role === 'mesera' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                                    'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                            }`}>
                                            {profile.role === 'mesera' ? 'Mesera (Exo)' : profile.role}
                                        </span>
                                    </td>
                                    <td className="px-10 py-8">
                                        <div className="flex items-center gap-2 text-slate-500 font-black uppercase tracking-widest text-[10px]">
                                            <Store className="w-3 h-3" />
                                            {profile.restaurant?.name || 'Sistema Central'}
                                        </div>
                                    </td>
                                    <td className="px-10 py-8">
                                        <div className="flex justify-end gap-3 translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                            <button
                                                onClick={() => handleEdit(profile)}
                                                className="p-4 bg-slate-800 hover:bg-emerald-500 text-slate-400 hover:text-slate-900 rounded-2xl transition-all shadow-xl"
                                            >
                                                <Edit2 className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(profile.id)}
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
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-6">
                {users.map((profile) => (
                    <div key={profile.id} className="bg-slate-900/50 backdrop-blur-md p-8 rounded-[3rem] border border-slate-800 relative group overflow-hidden">
                        <div className="absolute top-0 right-0 p-8">
                            <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${profile.role === 'admin' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                profile.role === 'kitchen' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                    profile.role === 'mesera' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                }`}>
                                {profile.role}
                            </span>
                        </div>

                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center font-black text-emerald-500 border border-slate-700 text-xl">
                                {profile.full_name?.charAt(0) || 'U'}
                            </div>
                            <div>
                                <h3 className="font-black text-white text-xl italic tracking-tighter uppercase leading-tight">
                                    {profile.full_name}
                                </h3>
                                <div className="flex items-center gap-1.5 mt-1 text-slate-500">
                                    <Mail className="w-3 h-3" />
                                    <span className="text-xs font-bold tracking-tight truncate max-w-[150px]">{profile.email}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex items-center gap-4 mb-8">
                            <Store className="w-5 h-5 text-emerald-500/50" />
                            <div>
                                <p className="text-[8px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Centro de Trabajo</p>
                                <p className="text-xs font-black text-white uppercase tracking-widest">{profile.restaurant?.name || 'GLOBAL'}</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => handleEdit(profile)}
                                className="flex-1 py-4 bg-slate-800 text-slate-400 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                            >
                                <Edit2 className="w-4 h-4" />
                                Ajustar
                            </button>
                            <button
                                onClick={() => handleDelete(profile.id)}
                                className="flex-1 py-4 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                            >
                                <Trash2 className="w-4 h-4" />
                                Remover
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Empty State */}
            {users.length === 0 && (
                <div className="p-24 text-center bg-slate-900/20 rounded-[4rem] border border-dashed border-slate-800">
                    <Users className="w-16 h-16 text-slate-700 mx-auto mb-6" />
                    <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">Sin Equipo Registrado</h2>
                    <p className="text-slate-500 font-bold text-sm">Comienza a construir tu equipo de trabajo hoy mismo.</p>
                </div>
            )}

            {/* Modal Redesign */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-500">
                    <div className="bg-slate-900 w-full max-w-2xl rounded-[3rem] border border-slate-800 shadow-2xl relative animate-in zoom-in-95 duration-500">
                        <div className="p-10 md:p-12 border-b border-slate-800/50 flex justify-between items-center bg-slate-900/50 backdrop-blur-md rounded-t-[3rem] sticky top-0 z-10">
                            <div>
                                <h1 className="text-3xl md:text-4xl font-black text-white italic tracking-tighter uppercase leading-none">
                                    {editingUser ? 'Editar' : 'Nuevo'} Miembro
                                </h1>
                                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px] mt-2 italic">Credenciales y Seguridad</p>
                            </div>
                            <button
                                onClick={handleCloseModal}
                                className="p-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl transition-all"
                            >
                                <CloseIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-10 md:p-12 space-y-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Nombre completo del trabajador</label>
                                <div className="relative group">
                                    <input
                                        name="fullName"
                                        required
                                        defaultValue={editingUser?.full_name || ''}
                                        className="w-full px-8 py-5 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-white uppercase italic tracking-tighter text-lg"
                                        placeholder="EJ. JUAN PÉREZ"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Correo Electrónico</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-emerald-500 transition-colors" />
                                        <input
                                            name="email"
                                            type="email"
                                            required
                                            defaultValue={editingUser?.email || ''}
                                            className="w-full pl-14 pr-8 py-5 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-white text-sm"
                                            placeholder="cocina@orderpoint.com"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">
                                        Clave de Acceso {editingUser && '(Opcional)'}
                                    </label>
                                    <div className="relative group">
                                        <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-emerald-500 transition-colors" />
                                        <input
                                            name="password"
                                            type="password"
                                            required={!editingUser}
                                            className="w-full pl-14 pr-8 py-5 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-white text-sm"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className={`grid ${userProfile?.is_super_admin ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-8`}>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Nivel de Privilegios (Rol)</label>
                                    <select
                                        name="role"
                                        defaultValue={editingUser?.role || 'kitchen'}
                                        className="w-full px-8 py-5 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-white appearance-none uppercase tracking-widest text-xs italic"
                                    >
                                        <option value="mesera" className="bg-slate-900">Mesera (Servicio)</option>
                                        <option value="kitchen" className="bg-slate-900">Equipo de Cocina</option>
                                        <option value="kiosk" className="bg-slate-900">Terminal de Quiosco</option>
                                        <option value="admin" className="bg-slate-900">Administrador de Local</option>
                                    </select>
                                </div>

                                {userProfile?.is_super_admin && (
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Asignación de Restaurante</label>
                                        <select
                                            name="restaurantId"
                                            defaultValue={editingUser?.restaurant_id || ''}
                                            className="w-full px-8 py-5 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-white appearance-none uppercase tracking-widest text-xs italic"
                                        >
                                            <option value="" className="bg-slate-900">Seleccionar Localidad...</option>
                                            {restaurants.map(r => (
                                                <option key={r.id} value={r.id} className="bg-slate-900">{r.name.toUpperCase()}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {error && (
                                <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest animate-pulse">
                                    ⚠️ {error}
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-6 pt-6">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 py-6 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-[2rem] font-black uppercase tracking-widest transition-all active:scale-95 text-[10px] shadow-xl"
                                >
                                    Descartar
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex-[2] py-6 bg-emerald-500 text-slate-900 rounded-[2rem] font-black uppercase tracking-widest shadow-[0_10px_40px_rgba(16,185,129,0.3)] hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 text-[10px] text-center"
                                >
                                    {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingUser ? 'Actualizar Ficha' : 'Habilitar Acceso')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
