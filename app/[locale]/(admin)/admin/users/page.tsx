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
    Store,
    MoreVertical,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [deleteUserProfile, setDeleteUserProfile] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteStatus, setDeleteStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const supabase = createClient();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (openMenuId) {
                const target = event.target as HTMLElement;
                if (!target.closest('.kebab-container')) {
                    setOpenMenuId(null);
                }
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [openMenuId]);

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

    const handleConfirmDelete = async () => {
        if (!deleteUserProfile) return;
        setIsDeleting(true);
        setDeleteStatus(null);
        
        const result = await deleteStaffUser(deleteUserProfile.id);
        setIsDeleting(false);

        if (!result.error) {
            setDeleteStatus({ type: 'success', message: t('userDeletedSuccessfully') || 'Miembro eliminado correctamente.' });
            loadData();
            setTimeout(() => {
                setDeleteUserProfile(null);
                setDeleteStatus(null);
            }, 2000);
        } else {
            setDeleteStatus({ type: 'error', message: result.error || 'Error al eliminar miembro.' });
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
                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">{t('loadingStaff')}</p>
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
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">{t('accessManagement')}</span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        {t('staff')}
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
                    <span>{t('addMember')}</span>
                </button>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block bg-slate-900/40 backdrop-blur-sm rounded-[3rem] border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full">
                        <thead className="bg-slate-950/20">
                            <tr>
                                <th className="px-10 py-8 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">{t('userName')}</th>
                                <th className="px-10 py-8 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">{t('email')}</th>
                                <th className="px-10 py-8 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">{t('assignedRole')}</th>
                                <th className="px-10 py-8 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">{t('branchOrRestaurant')}</th>
                                <th className="px-10 py-8 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">{t('actions')}</th>
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
                                            <span className="font-black text-white text-lg italic tracking-tighter uppercase flex items-center gap-2">
                                                {profile.full_name}
                                                {profile.is_pending && (
                                                    <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider not-italic">
                                                        Pendiente
                                                    </span>
                                                )}
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
                                            {profile.role === 'mesera' ? t('roleWaitressExo') : profile.role}
                                        </span>
                                    </td>
                                    <td className="px-10 py-8">
                                        <div className="flex items-center gap-2 text-slate-500 font-black uppercase tracking-widest text-[10px]">
                                            <Store className="w-3 h-3" />
                                            {profile.restaurant?.name || t('centralSystem')}
                                        </div>
                                    </td>
                                    <td className="px-10 py-8 relative kebab-container">
                                        <div className="flex justify-end">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenMenuId(openMenuId === profile.id ? null : profile.id);
                                                }}
                                                className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white transition-all duration-200 border border-slate-850"
                                                title="Acciones"
                                            >
                                                <MoreVertical className="w-4.5 h-4.5" />
                                            </button>

                                            {openMenuId === profile.id && (
                                                <div 
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="absolute right-10 mt-10 w-52 bg-slate-950/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl z-50 py-2.5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 text-left"
                                                >
                                                    {/* Editar miembro */}
                                                    <button
                                                        onClick={() => {
                                                            handleEdit(profile);
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="flex items-center gap-3 w-full px-4 py-3 text-slate-300 hover:text-white hover:bg-slate-900/50 transition-colors text-left text-xs font-bold uppercase tracking-wider"
                                                    >
                                                        <Edit2 className="w-4 h-4 text-emerald-500" />
                                                        {t('edit') || 'Editar'}
                                                    </button>

                                                    {userProfile?.id !== profile.id && (
                                                        <>
                                                            <div className="h-px bg-slate-800/60 my-1"></div>
                                                            {/* Eliminar (Destructivo) */}
                                                            <button
                                                                onClick={() => {
                                                                    setDeleteUserProfile(profile);
                                                                    setOpenMenuId(null);
                                                                }}
                                                                className="flex items-center gap-3 w-full px-4 py-3 text-red-500 hover:text-red-400 hover:bg-red-950/20 transition-colors text-left text-xs font-bold uppercase tracking-wider"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                                {t('remove') || 'Eliminar'}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
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
                                <h3 className="font-black text-white text-xl italic tracking-tighter uppercase leading-tight flex items-center gap-2">
                                    {profile.full_name}
                                    {profile.is_pending && (
                                        <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider not-italic">
                                            Pendiente
                                        </span>
                                    )}
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
                                <p className="text-[8px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">{t('workCenter')}</p>
                                <p className="text-xs font-black text-white uppercase tracking-widest">{profile.restaurant?.name || t('global')}</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => handleEdit(profile)}
                                className="flex-1 py-4 bg-slate-800 text-slate-400 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                            >
                                <Edit2 className="w-4 h-4" />
                                {t('adjust')}
                            </button>
                            <button
                                onClick={() => setDeleteUserProfile(profile)}
                                className="flex-1 py-4 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                            >
                                <Trash2 className="w-4 h-4" />
                                {t('remove')}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Empty State */}
            {users.length === 0 && (
                <div className="p-24 text-center bg-slate-900/20 rounded-[4rem] border border-dashed border-slate-800">
                    <Users className="w-16 h-16 text-slate-700 mx-auto mb-6" />
                    <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">{t('noTeamRegistered')}</h2>
                    <p className="text-slate-500 font-bold text-sm">{t('startBuildingTeam')}</p>
                </div>
            )}

            {/* Modal Redesign */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-500">
                    <div className="bg-slate-900 w-full max-w-2xl rounded-[3rem] border border-slate-800 shadow-2xl relative animate-in zoom-in-95 duration-500">
                        <div className="p-10 md:p-12 border-b border-slate-800/50 flex justify-between items-center bg-slate-900/50 backdrop-blur-md rounded-t-[3rem] sticky top-0 z-10">
                            <div>
                                <h1 className="text-3xl md:text-4xl font-black text-white italic tracking-tighter uppercase leading-none">
                                    {editingUser ? t('edit') : t('newMasc')} {t('member')}
                                </h1>
                                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px] mt-2 italic">{t('credentialsAndSecurity')}</p>
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
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">{t('workerFullName')}</label>
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
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">{t('email')}</label>
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
                                        {t('accessKey')} {editingUser && `(${t('optional')})`}
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
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">{t('privilegeLevelRole')}</label>
                                    <select
                                        name="role"
                                        defaultValue={editingUser?.role || 'kitchen'}
                                        className="w-full px-8 py-5 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-white appearance-none uppercase tracking-widest text-xs italic"
                                    >
                                        <option value="mesera" className="bg-slate-900">{t('waitressService')}</option>
                                        <option value="kitchen" className="bg-slate-900">{t('kitchenTeam')}</option>
                                        <option value="kiosk" className="bg-slate-900">{t('kioskTerminal')}</option>
                                        <option value="admin" className="bg-slate-900">{t('localAdmin')}</option>
                                    </select>
                                </div>

                                {userProfile?.is_super_admin && (
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">{t('restaurantAssignment')}</label>
                                        <select
                                            name="restaurantId"
                                            defaultValue={editingUser?.restaurant_id || ''}
                                            className="w-full px-8 py-5 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-white appearance-none uppercase tracking-widest text-xs italic"
                                        >
                                            <option value="" className="bg-slate-900">{t('selectLocation')}</option>
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
                                    {t('discard')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex-[2] py-6 bg-emerald-500 text-slate-900 rounded-[2rem] font-black uppercase tracking-widest shadow-[0_10px_40px_rgba(16,185,129,0.3)] hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 text-[10px] text-center"
                                >
                                    {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingUser ? t('updateRecord') : t('enableAccess'))}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Delete Confirmation Modal */}
            {deleteUserProfile && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-500">
                    <div className="bg-slate-900 w-full max-w-xl rounded-[3rem] border border-slate-800 shadow-2xl relative animate-in zoom-in-95 duration-300 overflow-hidden">
                        
                        <div className="bg-slate-900 p-10 md:p-12 relative flex items-end border-b border-slate-800/50">
                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                <Trash2 className="w-32 h-32 text-rose-500" />
                            </div>
                            <div className="relative z-10 w-full">
                                <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase italic text-white flex items-center gap-3">
                                    <Trash2 className="w-8 h-8 text-rose-500" />
                                    Eliminar Miembro
                                </h2>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Confirmación de Acción Destructiva</p>
                            </div>
                            <button
                                onClick={() => setDeleteUserProfile(null)}
                                className="absolute top-6 right-6 p-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl transition-all"
                            >
                                <CloseIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-10 md:p-12 space-y-6">
                            <p className="text-slate-350 font-black text-[10px] uppercase tracking-widest leading-relaxed">
                                ¿Estás seguro de que deseas eliminar permanentemente a este miembro del equipo? Esta acción removerá sus credenciales de acceso y su perfil.
                            </p>

                            <div className="p-6 bg-slate-950 rounded-[2rem] border border-slate-800 flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center font-black text-emerald-500 border border-slate-850 shrink-0">
                                    {deleteUserProfile.full_name?.charAt(0) || 'U'}
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">Miembro a Eliminar</p>
                                    <p className="font-black text-white text-lg italic uppercase tracking-tighter leading-none">{deleteUserProfile.full_name || 'Sin Nombre'}</p>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{deleteUserProfile.email}</p>
                                </div>
                            </div>

                            {deleteStatus && (
                                <div className={cn(
                                    "p-6 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-2 duration-300 font-black text-[10px] uppercase tracking-widest border",
                                    deleteStatus.type === 'success'
                                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                        : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                )}>
                                    {deleteStatus.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                                    <p>{deleteStatus.message}</p>
                                </div>
                            )}
                        </div>

                        <div className="p-10 md:p-12 bg-slate-900/50 flex flex-col sm:flex-row gap-6 border-t border-slate-800/50">
                            <button
                                className="flex-1 py-6 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-[2rem] font-black uppercase tracking-widest transition-all active:scale-95 text-xs shadow-xl"
                                onClick={() => setDeleteUserProfile(null)}
                                disabled={isDeleting}
                            >
                                Cancelar
                            </button>
                            <button
                                className="flex-[2] py-6 bg-rose-600 text-white hover:bg-rose-500 rounded-[2rem] font-black uppercase tracking-widest shadow-[0_10px_40px_rgba(244,63,94,0.3)] hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 text-xs text-center"
                                onClick={handleConfirmDelete}
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Eliminando...' : 'Confirmar y Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
