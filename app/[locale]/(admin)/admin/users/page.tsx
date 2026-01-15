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
                    ? supabase.from('restaurants').select('*')
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
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 lg:p-10 pb-20 md:pb-10">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-secondary-900 tracking-tight">Personal</h1>
                    <p className="text-secondary-500 font-bold mt-1 text-sm md:text-base">Gestiona los accesos de cocina y quioscos.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingUser(null);
                        setShowModal(true);
                    }}
                    className="w-full md:w-auto flex items-center justify-center gap-3 bg-primary-500 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary-500/20 hover:-translate-y-1 transition-all active:scale-95"
                >
                    <UserPlus className="w-5 h-5" />
                    <span>Añadir Personal</span>
                </button>
            </header>

            {/* Mobile Card View */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
                {users.map((profile) => (
                    <div key={profile.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-secondary-100 relative group">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="font-black text-secondary-900 text-lg leading-tight">{profile.full_name}</h3>
                                <div className="flex items-center gap-1.5 mt-1 text-secondary-400">
                                    <Mail className="w-3 h-3" />
                                    <span className="text-xs font-bold">{profile.email || '—'}</span>
                                </div>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${profile.role === 'admin' ? 'bg-primary-100 text-primary-700' :
                                profile.role === 'kitchen' ? 'bg-blue-100 text-blue-700' :
                                    'bg-accent-100 text-accent-700'
                                }`}>
                                {profile.role}
                            </span>
                        </div>

                        <div className="mb-4">
                            <div className="bg-secondary-50 p-3 rounded-2xl border border-secondary-100 flex items-center gap-3">
                                <Store className="w-4 h-4 text-secondary-400" />
                                <div>
                                    <p className="text-[10px] text-secondary-400 font-bold uppercase tracking-wider">Restaurante</p>
                                    <p className="text-xs font-bold text-secondary-700">{profile.restaurant?.name || 'Sistema'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleEdit(profile)}
                                className="flex-1 py-3 bg-secondary-50 text-secondary-600 hover:bg-primary-50 hover:text-primary-600 rounded-xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-wider transition-colors"
                            >
                                <Edit2 className="w-4 h-4" />
                                Editar
                            </button>
                            <button
                                onClick={() => handleDelete(profile.id)}
                                className="flex-1 py-3 bg-secondary-50 text-secondary-600 hover:bg-red-50 hover:text-red-500 rounded-xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-wider transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Eliminar
                            </button>
                        </div>
                    </div>
                ))}
                {users.length === 0 && (
                    <div className="bg-white p-10 rounded-3xl text-center border border-secondary-100">
                        <Users className="w-12 h-12 text-secondary-200 mx-auto mb-4" />
                        <p className="font-bold text-secondary-400">No hay personal registrado.</p>
                    </div>
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-xl shadow-secondary-900/5 border border-secondary-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-secondary-50/50 text-secondary-400 text-[10px] md:text-xs uppercase font-black tracking-widest">
                            <tr>
                                <th className="px-6 md:px-8 py-4 md:py-5">Nombre</th>
                                <th className="px-6 md:px-8 py-4 md:py-5">Email</th>
                                <th className="px-6 md:px-8 py-4 md:py-5">Rol</th>
                                <th className="px-6 md:px-8 py-4 md:py-5">Restaurante</th>
                                <th className="px-6 md:px-8 py-4 md:py-5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary-50">
                            {users.map((profile) => (
                                <tr key={profile.id} className="hover:bg-secondary-50/30 transition-colors">
                                    <td className="px-6 md:px-8 py-4 md:py-6 font-black text-secondary-900">{profile.full_name}</td>
                                    <td className="px-6 md:px-8 py-4 md:py-6 text-secondary-500 font-bold text-sm">{profile.email || '—'}</td>
                                    <td className="px-6 md:px-8 py-4 md:py-6">
                                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${profile.role === 'admin' ? 'bg-primary-100 text-primary-700' :
                                            profile.role === 'kitchen' ? 'bg-blue-100 text-blue-700' :
                                                'bg-accent-100 text-accent-700'
                                            }`}>
                                            {profile.role}
                                        </span>
                                    </td>
                                    <td className="px-6 md:px-8 py-4 md:py-6 text-secondary-500 font-bold text-sm">
                                        {profile.restaurant?.name || 'Sistema'}
                                    </td>
                                    <td className="px-6 md:px-8 py-4 md:py-6 text-right">
                                        <div className="flex justify-end gap-1 md:gap-2">
                                            <button
                                                onClick={() => handleEdit(profile)}
                                                className="p-2 text-secondary-400 hover:bg-secondary-50 hover:text-secondary-600 rounded-xl transition-all"
                                            >
                                                <Edit2 className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(profile.id)}
                                                className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
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

            {/* Create User Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-secondary-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[2rem] md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in">
                        <div className="p-6 md:p-8 border-b border-secondary-50 flex justify-between items-center bg-secondary-50/30">
                            <h2 className="text-xl md:text-2xl font-black text-secondary-900">
                                {editingUser ? 'Editar Personal' : 'Añadir Personal'}
                            </h2>
                            <button
                                onClick={handleCloseModal}
                                className="p-2 md:p-3 hover:bg-white rounded-xl md:rounded-2xl transition-all shadow-sm border border-secondary-100"
                            >
                                <CloseIcon className="w-5 h-5 md:w-6 md:h-6 text-secondary-400" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-secondary-400 uppercase tracking-widest mb-1 px-2">Nombre Completo</label>
                                <input
                                    name="fullName"
                                    required
                                    defaultValue={editingUser?.full_name || ''}
                                    className="w-full px-6 py-4 bg-secondary-50 border border-secondary-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold text-secondary-900"
                                    placeholder="Ej. Juan Pérez"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-secondary-400 uppercase tracking-widest mb-1 px-2">Email</label>
                                <div className="relative group">
                                    <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400 group-focus-within:text-primary-500 transition-colors" />
                                    <input
                                        name="email"
                                        type="email"
                                        required
                                        defaultValue={editingUser?.email || ''}
                                        className="w-full pl-14 pr-6 py-4 bg-secondary-50 border border-secondary-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold text-secondary-900"
                                        placeholder="cocina@restaurante.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-secondary-400 uppercase tracking-widest mb-1 px-2">
                                    Contraseña {editingUser && '(Opcional)'}
                                </label>
                                <div className="relative group">
                                    <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400 group-focus-within:text-primary-500 transition-colors" />
                                    <input
                                        name="password"
                                        type="password"
                                        required={!editingUser}
                                        className="w-full pl-14 pr-6 py-4 bg-secondary-50 border border-secondary-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold text-secondary-900"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <div className={`grid ${userProfile?.is_super_admin ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-secondary-400 uppercase tracking-widest mb-1 px-2">Rol</label>
                                    <select
                                        name="role"
                                        defaultValue={editingUser?.role || 'kitchen'}
                                        className="w-full px-6 py-4 bg-secondary-50 border border-secondary-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold text-secondary-900 appearance-none"
                                    >
                                        <option value="kitchen">Cocina</option>
                                        <option value="kiosk">Quiosco</option>
                                        <option value="admin">Administrador</option>
                                    </select>
                                </div>
                                {userProfile?.is_super_admin && (
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-secondary-400 uppercase tracking-widest mb-1 px-2">Restaurante</label>
                                        <select
                                            name="restaurantId"
                                            defaultValue={editingUser?.restaurant_id || ''}
                                            className="w-full px-6 py-4 bg-secondary-50 border border-secondary-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold text-secondary-900 appearance-none"
                                        >
                                            <option value="">Seleccionar...</option>
                                            {restaurants.map(r => (
                                                <option key={r.id} value={r.id}>{r.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {error && (
                                <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-red-100">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={creating}
                                className="w-full bg-primary-500 text-white font-black py-5 rounded-[2rem] shadow-xl shadow-primary-500/20 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-widest"
                            >
                                {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingUser ? 'Guardar Cambios' : 'Crear Usuario')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
