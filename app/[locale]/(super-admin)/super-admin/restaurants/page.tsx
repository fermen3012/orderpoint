'use client';

import { useEffect, useState } from 'react';
import { adminSupabase } from '@/lib/supabase/admin-client';
import {
    Search,
    Plus,
    Building2,
    MoreVertical,
    Power,
    ExternalLink,
    X as CloseIcon,
    Globe,
    CheckCircle2,
    XCircle,
    UserPlus
} from 'lucide-react';
import InviteOwnerModal from '@/components/super-admin/InviteOwnerModal';
import { useRouter } from '@/i18n/routing';
import { createRestaurant, toggleRestaurantStatus } from './actions';

export default function SuperAdminRestaurants() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [restaurants, setRestaurants] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const [newRestaurant, setNewRestaurant] = useState({
        name: '',
        slug: '',
        logo_url: '',
        is_active: true
    });

    const [inviteModalData, setInviteModalData] = useState<{ id: string, name: string } | null>(null);

    useEffect(() => {
        loadRestaurants();
    }, []);

    const loadRestaurants = async () => {
        setLoading(true);
        const { data } = await adminSupabase
            .from('restaurants')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setRestaurants(data);
        setLoading(false);
    };

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        const result = await toggleRestaurantStatus(id, !currentStatus);

        if (!result.error) {
            setRestaurants(prev => prev.map(r => r.id === id ? { ...r, is_active: !currentStatus } : r));
        } else {
            alert('Error: ' + result.error);
        }
    };

    const handleCreateRestaurant = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const result = await createRestaurant(newRestaurant);

            if (!result.error) {
                setIsModalOpen(false);
                setNewRestaurant({ name: '', slug: '', logo_url: '', is_active: true });
                loadRestaurants();
            } else {
                alert('Error al crear el restaurante: ' + result.error);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const filteredRestaurants = restaurants.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.slug?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <main className="flex-1 p-8 md:p-12 overflow-y-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Gestión de Restaurantes</h1>
                    <p className="text-slate-500 font-bold mt-2">Administra todos los tenants de la plataforma.</p>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o slug..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-14 pr-6 py-4 bg-white border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-bold shadow-sm"
                        />
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-3 bg-primary-500 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary-500/20 hover:bg-primary-600 transition-all active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="hidden sm:inline">Nuevo Tenant</span>
                    </button>
                </div>
            </header>

            {/* Restaurants Table */}
            <div className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/80 text-slate-400 text-[10px] uppercase font-black tracking-[0.2em]">
                            <tr>
                                <th className="px-10 py-6">Restaurante</th>
                                <th className="px-10 py-6">Identificador (Slug)</th>
                                <th className="px-10 py-6">Estado</th>
                                <th className="px-10 py-6">Fecha Registro</th>
                                <th className="px-10 py-6 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-10 py-8 h-20 bg-slate-50/50"></td>
                                    </tr>
                                ))
                            ) : filteredRestaurants.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-10 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4 opacity-20">
                                            <Building2 className="w-16 h-16" />
                                            <p className="font-black uppercase tracking-widest">No se encontraron restaurantes</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredRestaurants.map((res) => (
                                <tr key={res.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-10 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                                                {res.logo_url ? (
                                                    <img src={res.logo_url} alt={res.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Building2 className="w-6 h-6 text-slate-400" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900 text-lg">{res.name}</p>
                                                <p className="text-xs text-slate-400 font-bold uppercase tracking-tight">ID: {res.id.slice(0, 8)}...</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-10 py-6">
                                        <div className="flex items-center gap-2 text-slate-600 font-bold bg-slate-100/50 px-4 py-2 rounded-xl border border-slate-100 w-fit">
                                            <Globe className="w-4 h-4 text-slate-400" />
                                            <span>{res.slug || 'sin-slug'}</span>
                                        </div>
                                    </td>
                                    <td className="px-10 py-6">
                                        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest w-fit shadow-sm ${res.is_active ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'
                                            }`}>
                                            {res.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                            {res.is_active ? 'Activo' : 'Suspendido'}
                                        </div>
                                    </td>
                                    <td className="px-10 py-6 text-slate-500 font-bold">
                                        {new Date(res.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-10 py-6 text-right">
                                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleToggleActive(res.id, res.is_active)}
                                                className={`p-3 rounded-xl transition-all ${res.is_active ? 'text-rose-500 hover:bg-rose-50' : 'text-green-500 hover:bg-green-50'
                                                    }`}
                                                title={res.is_active ? 'Desactivar' : 'Activar'}
                                            >
                                                <Power className="w-5 h-5" />
                                            </button>
                                            <button className="p-3 text-slate-400 hover:text-primary-500 hover:bg-primary-50 rounded-xl transition-all">
                                                <ExternalLink className="w-5 h-5" />
                                            </button>
                                            <button className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all">
                                                <MoreVertical className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => setInviteModalData({ id: res.id, name: res.name })}
                                                className="p-3 text-primary-500 hover:bg-primary-50 rounded-xl transition-all"
                                                title="Invitar Dueño"
                                            >
                                                <UserPlus className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Restaurant Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-scale-in">
                        <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Nuevo Restaurante</h2>
                                <p className="text-slate-500 font-bold mt-1">Registra un nuevo tenant en el sistema.</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-4 hover:bg-white rounded-2xl transition-all shadow-sm border border-slate-100"
                            >
                                <CloseIcon className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateRestaurant} className="p-10 space-y-8">
                            <div className="grid grid-cols-1 gap-8">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Nombre Comercial</label>
                                    <input
                                        type="text"
                                        required
                                        value={newRestaurant.name}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setNewRestaurant({
                                                ...newRestaurant,
                                                name: val,
                                                slug: val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                                            });
                                        }}
                                        className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-bold text-lg"
                                        placeholder="Ej: Burger King El Salvador"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Slug del Sistema</label>
                                    <div className="relative">
                                        <Globe className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input
                                            type="text"
                                            required
                                            value={newRestaurant.slug}
                                            onChange={(e) => setNewRestaurant({ ...newRestaurant, slug: e.target.value })}
                                            className="w-full pl-16 pr-8 py-5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-bold"
                                            placeholder="burger-king-es"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2 px-2 font-bold uppercase tracking-wider">Esto definirá la URL del restaurante: app.orderpoint.com/slug</p>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">URL del Logo (Opcional)</label>
                                    <input
                                        type="url"
                                        value={newRestaurant.logo_url}
                                        onChange={(e) => setNewRestaurant({ ...newRestaurant, logo_url: e.target.value })}
                                        className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-bold"
                                        placeholder="https://ejemplo.com/logo.png"
                                    />
                                </div>
                            </div>

                            <div className="pt-6">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-2xl shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50"
                                >
                                    {saving ? 'Creando Restaurante...' : 'Dar de Alta Restaurante'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Invite Owner Modal */}
            {inviteModalData && (
                <InviteOwnerModal
                    restaurantId={inviteModalData.id}
                    restaurantName={inviteModalData.name}
                    onClose={() => setInviteModalData(null)}
                />
            )}
        </main>
    );
}
