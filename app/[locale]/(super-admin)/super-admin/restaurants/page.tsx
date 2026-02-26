'use client';

import { useEffect, useState } from 'react';
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
    UserPlus,
    Calendar,
    Upload
} from 'lucide-react';
import InviteOwnerModal from '@/components/super-admin/InviteOwnerModal';
import RestaurantLogoModal from '@/components/super-admin/RestaurantLogoModal';
import { useRouter } from '@/i18n/routing';
import { createRestaurant, toggleRestaurantStatus, getRestaurants } from './actions';

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
    const [logoModalData, setLogoModalData] = useState<{ id: string, name: string, logo: string } | null>(null);
    const [inviteModalData, setInviteModalData] = useState<{ id: string, name: string } | null>(null);

    useEffect(() => {
        loadRestaurants();
    }, []);

    const loadRestaurants = async () => {
        setLoading(true);
        const { data, error } = await getRestaurants();

        if (error) {
            console.error(error);
        } else if (data) {
            setRestaurants(data);
        }
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

    const handleLogoSuccess = (newUrl: string) => {
        if (logoModalData) {
            setRestaurants(prev => prev.map(r => r.id === logoModalData.id ? { ...r, logo_url: newUrl } : r));
            setLogoModalData(null);
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

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Cargando Restaurantes...</p>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-700 w-full overflow-hidden">
            {/* Header Section */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-8 h-1 bg-emerald-500 rounded-full"></span>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Gestión Global</span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        Tenants
                    </h1>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-6 w-full xl:w-auto">
                    <div className="relative group flex-1 xl:w-80">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="FILTRAR POR NOMBRE O SLUG..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-16 pr-8 py-5 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-3xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-white text-xs uppercase tracking-widest"
                        />
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="group relative flex items-center justify-center gap-3 px-10 py-5 bg-emerald-500 text-slate-900 rounded-[2rem] font-black uppercase tracking-widest shadow-[0_10px_25px_rgba(16,185,129,0.3)] hover:-translate-y-1 transition-all active:scale-95 whitespace-nowrap"
                    >
                        <Plus className="w-6 h-6" />
                        <span>Nuevo Tenant</span>
                    </button>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block bg-slate-900/40 backdrop-blur-sm rounded-[3.5rem] border border-slate-800 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full">
                        <thead className="bg-slate-950/20 border-b border-slate-800/50">
                            <tr>
                                <th className="px-12 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-left">Restaurante / Tenant</th>
                                <th className="px-12 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-left">Identificador</th>
                                <th className="px-12 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-left">Estado</th>
                                <th className="px-12 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-left">Alta</th>
                                <th className="px-12 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-right">Controles</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {filteredRestaurants.map((res, idx) => (
                                <tr key={res.id} className="group hover:bg-slate-800/20 transition-all duration-300">
                                    <td className="px-12 py-8">
                                        <div className="flex items-center gap-6">
                                            <div className="w-14 h-14 rounded-[1.25rem] bg-slate-950 flex items-center justify-center border border-slate-800 group-hover:border-emerald-500/30 transition-all duration-500 shadow-xl overflow-hidden">
                                                {res.logo_url ? (
                                                    <img src={res.logo_url} alt={res.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Building2 className="w-7 h-7 text-slate-700 group-hover:text-emerald-500 transition-colors" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-black text-white text-xl italic tracking-tighter uppercase group-hover:text-emerald-500 transition-colors">
                                                    {res.name}
                                                </p>
                                                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-1">ID: {res.id.substring(0, 8)}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-12 py-8">
                                        <div className="flex items-center gap-2 text-slate-400 font-bold bg-slate-900 px-4 py-2 rounded-xl border border-slate-800 w-fit">
                                            <Globe className="w-4 h-4 text-emerald-500/50" />
                                            <span className="font-black text-xs uppercase tracking-widest">{res.slug || 'sin-slug'}</span>
                                        </div>
                                    </td>
                                    <td className="px-12 py-8">
                                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest w-fit border ${res.is_active
                                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                                            }`}>
                                            {res.is_active ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                            {res.is_active ? 'Activo' : 'Suspendido'}
                                        </div>
                                    </td>
                                    <td className="px-12 py-8">
                                        <div className="flex items-center gap-2 text-slate-500 group-hover:text-slate-300 transition-colors">
                                            <Calendar className="w-4 h-4" />
                                            <span className="font-black text-xs uppercase tracking-widest">
                                                {new Date(res.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-12 py-8">
                                        <div className="flex justify-end gap-3 translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                            <button
                                                onClick={() => handleToggleActive(res.id, res.is_active)}
                                                className={`p-4 rounded-2xl transition-all shadow-xl border ${res.is_active
                                                        ? 'bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border-rose-500/20'
                                                        : 'bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-slate-900 border-emerald-500/20'
                                                    }`}
                                                title={res.is_active ? 'Desactivar' : 'Activar'}
                                            >
                                                <Power className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => setLogoModalData({ id: res.id, name: res.name, logo: res.logo_url })}
                                                className="p-4 bg-slate-800 hover:bg-blue-500 text-slate-400 hover:text-white rounded-2xl transition-all shadow-xl"
                                                title="Subir Logo (PNG)"
                                            >
                                                <Upload className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => setInviteModalData({ id: res.id, name: res.name })}
                                                className="p-4 bg-slate-800 hover:bg-emerald-500 text-slate-400 hover:text-slate-900 rounded-2xl transition-all shadow-xl"
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

                    {filteredRestaurants.length === 0 && (
                        <div className="p-32 text-center">
                            <Building2 className="w-16 h-16 text-slate-800 mx-auto mb-6" />
                            <h2 className="text-2xl font-black text-slate-700 uppercase italic tracking-tighter">No Hay Restaurantes Aún</h2>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-6">
                {filteredRestaurants.map((res) => (
                    <div key={res.id} className="bg-slate-900/50 backdrop-blur-md p-8 rounded-[3rem] border border-slate-800 relative group overflow-hidden">
                        <div className="flex items-center gap-5 mb-8">
                            <div className="w-16 h-16 rounded-[1.5rem] bg-slate-950 flex items-center justify-center border border-slate-800 shadow-xl overflow-hidden flex-shrink-0">
                                {res.logo_url ? (
                                    <img src={res.logo_url} alt={res.name} className="w-full h-full object-cover" />
                                ) : (
                                    <Building2 className="w-8 h-8 text-emerald-500/50" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-black text-white text-2xl italic tracking-tighter uppercase leading-tight truncate group-hover:text-emerald-500 transition-colors">
                                    {res.name}
                                </h3>
                                <div className="flex items-center gap-1.5 mt-1 text-slate-600">
                                    <Globe className="w-3 h-3 flex-shrink-0 text-emerald-500" />
                                    <span className="text-[10px] font-black uppercase tracking-widest truncate">{res.slug || 'sin-slug'}</span>
                                </div>
                            </div>
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 border ${res.is_active ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                                }`}>
                                {res.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                {res.is_active ? 'Act' : 'Off'}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">ID</p>
                                <p className="font-mono text-xs font-black text-slate-300 truncate">{res.id.slice(0, 8)}</p>
                            </div>
                            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Registro</p>
                                <div className="flex items-center gap-1.5 text-slate-300">
                                    <Calendar className="w-3 h-3 flex-shrink-0" />
                                    <p className="text-xs font-black uppercase tracking-widest truncate">{new Date(res.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <button
                                onClick={() => handleToggleActive(res.id, res.is_active)}
                                className={`py-4 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg border ${res.is_active
                                        ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                                        : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                    }`}
                            >
                                <Power className="w-4 h-4" />
                                {res.is_active ? 'Apagar' : 'Encender'}
                            </button>
                            <button
                                onClick={() => setLogoModalData({ id: res.id, name: res.name, logo: res.logo_url })}
                                className="py-4 bg-slate-800 text-slate-400 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg border border-slate-700"
                            >
                                <Upload className="w-4 h-4" />
                                Logo
                            </button>
                            <button
                                onClick={() => setInviteModalData({ id: res.id, name: res.name })}
                                className="py-4 bg-emerald-500 text-slate-900 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg"
                            >
                                <UserPlus className="w-4 h-4" />
                                Invitar
                            </button>
                        </div>
                    </div>
                ))}

                {filteredRestaurants.length === 0 && (
                    <div className="p-20 text-center bg-slate-900/20 rounded-[3rem] border border-dashed border-slate-800">
                        <Search className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                        <p className="font-black text-slate-600 uppercase tracking-widest text-xs">No hay coincidencias.</p>
                    </div>
                )}
            </div>

            {/* Create Restaurant Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-500">
                    <div className="bg-slate-900 w-full max-w-xl rounded-[3rem] border border-slate-800 shadow-2xl relative animate-in zoom-in-95 duration-300">
                        <div className="p-10 md:p-12 border-b border-slate-800/50 flex justify-between items-center bg-slate-900/50 backdrop-blur-md rounded-t-[3rem]">
                            <div>
                                <h1 className="text-3xl md:text-4xl font-black text-white italic tracking-tighter uppercase leading-none">
                                    Nuevo Tenant
                                </h1>
                                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px] mt-2 italic">Despliegue de Restaurante</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl transition-all"
                            >
                                <CloseIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateRestaurant} className="p-10 md:p-12 space-y-10">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Nombre Comercial</label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    value={newRestaurant.name}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setNewRestaurant({
                                            ...newRestaurant,
                                            name: val,
                                            slug: val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                                        });
                                    }}
                                    className="w-full px-8 py-6 bg-slate-950 border border-slate-800 rounded-[2rem] focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-white uppercase italic tracking-tighter text-2xl shadow-inner placeholder:text-slate-800"
                                    placeholder="EJ: BURGER KING SV"
                                />
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Identificador de Sistema (Slug)</label>
                                <div className="relative">
                                    <Globe className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-600" />
                                    <input
                                        type="text"
                                        required
                                        value={newRestaurant.slug}
                                        onChange={(e) => setNewRestaurant({ ...newRestaurant, slug: e.target.value })}
                                        className="w-full pl-16 pr-8 py-6 bg-slate-950 border border-slate-800 rounded-[2rem] focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-white uppercase tracking-widest text-sm shadow-inner placeholder:text-slate-800"
                                        placeholder="burger-king-sv"
                                    />
                                </div>
                                <p className="text-[9px] text-emerald-500/70 font-black uppercase tracking-widest ml-4">URL Base: app.orderpoint.com/{newRestaurant.slug || 'slug'}</p>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">URL del Ícono (Opcional)</label>
                                <input
                                    type="url"
                                    value={newRestaurant.logo_url}
                                    onChange={(e) => setNewRestaurant({ ...newRestaurant, logo_url: e.target.value })}
                                    className="w-full px-8 py-6 bg-slate-950 border border-slate-800 rounded-[2rem] focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-white text-sm shadow-inner placeholder:text-slate-800 placeholder:italic placeholder:font-normal"
                                    placeholder="https://..."
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
                                    {saving ? 'Desplegando...' : 'Crear Entorno Tenant'}
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

            {/* Logo Upload Modal */}
            {logoModalData && (
                <RestaurantLogoModal
                    restaurantId={logoModalData.id}
                    restaurantName={logoModalData.name}
                    currentLogoUrl={logoModalData.logo}
                    onClose={() => setLogoModalData(null)}
                    onSuccess={handleLogoSuccess}
                />
            )}
        </div>
    );
}
