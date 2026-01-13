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
    X as CloseIcon
} from 'lucide-react';
import { SidebarLink } from '../dashboard/page';
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
        <div className="flex min-h-screen bg-background">
            {/* Sidebar - Reusing Sidebar from Dashboard */}
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
                        icon={<Users className="w-5 h-5" />}
                        label={t('users')}
                        active
                        onClick={() => router.push('/admin/users')}
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
            <main className="flex-1 p-6 md:p-10">
                <header className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-4xl font-black text-secondary-900 tracking-tight">Personal</h1>
                        <p className="text-secondary-500 font-bold mt-1">Gestiona los accesos de cocina y quioscos.</p>
                    </div>
                    <button
                        onClick={() => {
                            setEditingUser(null);
                            setShowModal(true);
                        }}
                        className="flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-primary-200 hover:bg-primary-700 transition-all active:scale-95"
                    >
                        <UserPlus className="w-5 h-5" />
                        <span>Añadir Personal</span>
                    </button>
                </header>

                <div className="bg-white rounded-[2.5rem] shadow-xl shadow-secondary-900/5 border border-secondary-100 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-secondary-50/50 text-secondary-400 text-xs uppercase font-black tracking-widest">
                            <tr>
                                <th className="px-8 py-5">Nombre</th>
                                <th className="px-8 py-5">Email</th>
                                <th className="px-8 py-5">Rol</th>
                                <th className="px-8 py-5">Restaurante</th>
                                <th className="px-8 py-5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary-50">
                            {users.map((profile) => (
                                <tr key={profile.id} className="hover:bg-secondary-50/30 transition-colors">
                                    <td className="px-8 py-6 font-black text-secondary-900">{profile.full_name}</td>
                                    <td className="px-8 py-6 text-secondary-500 font-bold">{profile.email || '—'}</td>
                                    <td className="px-8 py-6">
                                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${profile.role === 'admin' ? 'bg-primary-100 text-primary-700' :
                                            profile.role === 'kitchen' ? 'bg-blue-100 text-blue-700' :
                                                'bg-accent-100 text-accent-700'
                                            }`}>
                                            {profile.role}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-secondary-500 font-bold">
                                        {profile.restaurant?.name || 'Sistema'}
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex justify-end gap-2">
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

                {/* Create User Modal */}
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-secondary-900/60 backdrop-blur-sm">
                        <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in">
                            <div className="p-8 border-b border-secondary-50 flex justify-between items-center">
                                <h2 className="text-2xl font-black text-secondary-900">
                                    {editingUser ? 'Editar Personal' : 'Añadir Personal'}
                                </h2>
                                <button
                                    onClick={handleCloseModal}
                                    className="p-2 hover:bg-secondary-50 rounded-xl"
                                >
                                    <CloseIcon className="w-6 h-6 text-secondary-400" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-8 space-y-6">
                                <div>
                                    <label className="block text-sm font-black text-secondary-400 uppercase tracking-widest mb-2">Nombre Completo</label>
                                    <input
                                        name="fullName"
                                        required
                                        defaultValue={editingUser?.full_name || ''}
                                        className="w-full px-4 py-3 bg-secondary-50 border border-secondary-100 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                                        placeholder="Ej. Juan Pérez"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-black text-secondary-400 uppercase tracking-widest mb-2">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
                                        <input
                                            name="email"
                                            type="email"
                                            required
                                            defaultValue={editingUser?.email || ''}
                                            className="w-full pl-10 pr-4 py-3 bg-secondary-50 border border-secondary-100 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                                            placeholder="cocina@restaurante.com"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-black text-secondary-400 uppercase tracking-widest mb-2">
                                        Contraseña {editingUser && '(Dejar en blanco para no cambiar)'}
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
                                        <input
                                            name="password"
                                            type="password"
                                            required={!editingUser}
                                            className="w-full pl-10 pr-4 py-3 bg-secondary-50 border border-secondary-100 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>

                                <div className={`grid ${userProfile?.is_super_admin ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                                    <div>
                                        <label className="block text-sm font-black text-secondary-400 uppercase tracking-widest mb-2">Rol</label>
                                        <select
                                            name="role"
                                            defaultValue={editingUser?.role || 'kitchen'}
                                            className="w-full px-4 py-3 bg-secondary-50 border border-secondary-100 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none font-bold"
                                        >
                                            <option value="kitchen">Cocina</option>
                                            <option value="kiosk">Quiosco</option>
                                            <option value="admin">Administrador</option>
                                        </select>
                                    </div>
                                    {userProfile?.is_super_admin && (
                                        <div>
                                            <label className="block text-sm font-black text-secondary-400 uppercase tracking-widest mb-2">Restaurante</label>
                                            <select
                                                name="restaurantId"
                                                defaultValue={editingUser?.restaurant_id || ''}
                                                className="w-full px-4 py-3 bg-secondary-50 border border-secondary-100 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none font-bold"
                                            >
                                                <option value="">Seleccionar Restaurante</option>
                                                {restaurants.map(r => (
                                                    <option key={r.id} value={r.id}>{r.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {error && (
                                    <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold">
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="w-full bg-primary-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-primary-200 hover:bg-primary-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingUser ? 'Guardar Cambios' : 'Crear Usuario')}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
