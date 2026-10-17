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
    Upload,
    Trash2,
    Loader2,
    ChefHat,
    FileSpreadsheet,
    FileText,
    Layers,
    Sparkles,
    Smartphone,
    Tv,
    Utensils,
    CreditCard
} from 'lucide-react';
import InviteOwnerModal from '@/components/super-admin/InviteOwnerModal';
import RestaurantLogoModal from '@/components/super-admin/RestaurantLogoModal';
import { useRouter, Link } from '@/i18n/routing';
import {
    createRestaurant,
    toggleRestaurantStatus,
    getRestaurants,
    deleteRestaurant
} from './actions';
import { getSubscriptionPlans, updateRestaurantPlan } from '@/actions/plans-admin';
import type { SubscriptionPlan } from '@/lib/subscription-plans';

export default function SuperAdminRestaurants() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [restaurants, setRestaurants] = useState<any[]>([]);
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    // Estado del nuevo restaurante con plan asignado
    const [newRestaurant, setNewRestaurant] = useState({
        name: '',
        slug: '',
        logo_url: '',
        is_active: true,
        plan_id: 'plan_exo_salon',
        custom_price: '',
        owner_email: '',
        seed_demo_data: true
    });

    // Estado para modal de editar plan de restaurante existente
    const [editPlanModalData, setEditPlanModalData] = useState<{ id: string; name: string; plan_id: string; unit_price: number } | null>(null);
    const [selectedPlanToEdit, setSelectedPlanToEdit] = useState<string>('plan_exo_salon');
    const [editCustomPrice, setEditCustomPrice] = useState<string>('99');
    const [updatingPlan, setUpdatingPlan] = useState<boolean>(false);

    const [logoModalData, setLogoModalData] = useState<{ id: string, name: string, logo: string } | null>(null);
    const [inviteModalData, setInviteModalData] = useState<{
        id: string;
        name: string;
        initialInviteLink?: string | null;
        initialEmail?: string | null;
        initialEmailSent?: boolean;
    } | null>(null);
    const [deleteModalData, setDeleteModalData] = useState<{ id: string, name: string } | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    const handleDeleteRestaurant = async () => {
        if (!deleteModalData) return;
        setDeleting(true);
        try {
            const result = await deleteRestaurant(deleteModalData.id);
            if (result.error) {
                alert('Error al eliminar el restaurante: ' + result.error);
            } else {
                setDeleteModalData(null);
                loadRestaurants();
            }
        } catch (err) {
            console.error(err);
            alert('Ocurrió un error inesperado al eliminar el restaurante.');
        } finally {
            setDeleting(false);
        }
    };

    useEffect(() => {
        loadRestaurants();
    }, []);

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

    const loadRestaurants = async () => {
        setLoading(true);
        try {
            const resResult = await getRestaurants();

            if (resResult.error) {
                console.error('getRestaurants error:', resResult.error);
            } else {
                if (resResult.data) {
                    setRestaurants(resResult.data);
                }
                if (resResult.plans && resResult.plans.length > 0) {
                    setPlans(resResult.plans);
                    if (!newRestaurant.plan_id) {
                        setNewRestaurant(prev => ({ ...prev, plan_id: resResult.plans[0].id }));
                    }
                }
            }
        } catch (err) {
            console.error('Error loading restaurants and plans:', err);
        } finally {
            setLoading(false);
        }
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
            const customPriceNum = newRestaurant.custom_price ? parseFloat(newRestaurant.custom_price) : undefined;
            const ownerEmailTrimmed = newRestaurant.owner_email ? newRestaurant.owner_email.trim() : undefined;
            const result = await createRestaurant({
                name: newRestaurant.name,
                slug: newRestaurant.slug,
                logo_url: newRestaurant.logo_url,
                plan_id: newRestaurant.plan_id,
                custom_price: customPriceNum,
                owner_email: ownerEmailTrimmed,
                seed_demo_data: newRestaurant.seed_demo_data,
            });

            if (!result.error && result.data) {
                setIsModalOpen(false);
                const createdId = result.data.id;
                const createdName = result.data.name || newRestaurant.name;

                if (result.inviteResult && !(result.inviteResult as any).error && (result.inviteResult as any).inviteLink) {
                    setInviteModalData({
                        id: createdId,
                        name: createdName,
                        initialInviteLink: (result.inviteResult as any).inviteLink,
                        initialEmail: ownerEmailTrimmed || null,
                        initialEmailSent: Boolean((result.inviteResult as any).emailSent)
                    });
                } else {
                    if (result.inviteResult && (result.inviteResult as any).error) {
                        alert(`Restaurante "${createdName}" creado.\nAviso sobre invitación: ${(result.inviteResult as any).error}`);
                    }
                    setInviteModalData({
                        id: createdId,
                        name: createdName
                    });
                }

                setNewRestaurant({
                    name: '',
                    slug: '',
                    logo_url: '',
                    is_active: true,
                    plan_id: plans[0]?.id || 'plan_exo_salon',
                    custom_price: '',
                    owner_email: '',
                    seed_demo_data: true
                });
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

    const handleOpenEditPlanModal = (res: any) => {
        setEditPlanModalData({
            id: res.id,
            name: res.name,
            plan_id: res.plan_id || 'plan_exo_salon',
            unit_price: res.unit_price || 99
        });
        setSelectedPlanToEdit(res.plan_id || 'plan_exo_salon');
        setEditCustomPrice((res.unit_price || 99).toString());
    };

    const handleSaveRestaurantPlan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editPlanModalData) return;

        setUpdatingPlan(true);
        try {
            const priceNum = parseFloat(editCustomPrice);
            const res = await updateRestaurantPlan(
                editPlanModalData.id,
                selectedPlanToEdit,
                isNaN(priceNum) ? undefined : priceNum
            );

            if (res.success) {
                alert(`Plan "${res.planName}" asignado con éxito a ${editPlanModalData.name}.`);
                setEditPlanModalData(null);
                loadRestaurants();
            } else {
                alert('Error al actualizar el plan: ' + res.error);
            }
        } catch (err) {
            console.error(err);
            alert('Ocurrió un error inesperado al actualizar el plan.');
        } finally {
            setUpdatingPlan(false);
        }
    };

    const filteredRestaurants = restaurants.filter(r =>
        (r.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.slug || '').toLowerCase().includes(searchQuery.toLowerCase())
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
            <div className="hidden lg:block bg-[#0B1120] rounded-[3.5rem] border border-slate-800 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full">
                        <thead className="bg-slate-950/20 border-b border-slate-800/50">
                            <tr>
                                <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-left">Restaurante / Tenant</th>
                                <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-left">Identificador</th>
                                <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-left">Plan SaaS</th>
                                <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-left">Estado</th>
                                <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-left">Alta</th>
                                <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-right">Controles</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {filteredRestaurants.map((res, idx) => (
                                <tr key={res.id} className="group hover:bg-slate-800/20 transition-all duration-300">
                                    <td className="px-6 py-4">
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
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-slate-400 font-bold bg-slate-900 px-4 py-2 rounded-xl border border-slate-800 w-fit">
                                            <Globe className="w-4 h-4 text-emerald-500/50" />
                                            <span className="font-black text-xs uppercase tracking-widest">{res.slug || 'sin-slug'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenEditPlanModal(res)}
                                            className="group/plan flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border bg-slate-900/90 hover:bg-slate-800 border-slate-800 hover:border-emerald-500/50 transition-all text-left shadow-sm"
                                            title="Clic para editar plan"
                                        >
                                            <Layers className="w-4 h-4 text-emerald-400 group-hover/plan:rotate-12 transition-transform shrink-0" />
                                            <div>
                                                <span className="text-white block leading-tight truncate max-w-[150px]">{res.plan_name || 'Salón & Cocina'}</span>
                                                <span className="text-emerald-400 font-mono text-[9px] block">${res.unit_price || 99}/mes</span>
                                            </div>
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest w-fit border ${res.is_active
                                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                                            }`}>
                                            {res.is_active ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                            {res.is_active ? 'Activo' : 'Suspendido'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-slate-500 group-hover:text-slate-300 transition-colors">
                                            <Calendar className="w-4 h-4" />
                                            <span className="font-black text-xs uppercase tracking-widest">
                                                {new Date(res.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 relative kebab-container">
                                        <div className="flex justify-end">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenMenuId(openMenuId === res.id ? null : res.id);
                                                }}
                                                className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white transition-all duration-200 border border-slate-850"
                                                title="Acciones"
                                            >
                                                <MoreVertical className="w-4.5 h-4.5" />
                                            </button>

                                            {openMenuId === res.id && (
                                                <div 
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="absolute right-6 mt-10 w-56 bg-slate-950/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl z-50 py-2.5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                                                >
                                                    {/* Ver Menú */}
                                                    <Link
                                                        href={`/super-admin/restaurants/${res.id}/menu`}
                                                        onClick={() => setOpenMenuId(null)}
                                                        className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:text-white hover:bg-slate-900/50 transition-colors text-xs font-bold uppercase tracking-wider"
                                                    >
                                                        <ChefHat className="w-4 h-4 text-emerald-500" />
                                                        Ver Menú
                                                    </Link>

                                                    {/* Probar Salón (Exo Server) */}
                                                    <a
                                                        href={`/exo/tables?restaurant_id=${res.id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={() => setOpenMenuId(null)}
                                                        className="flex items-center gap-3 px-4 py-3 text-emerald-400 hover:text-emerald-300 hover:bg-slate-900/50 transition-colors text-xs font-bold uppercase tracking-wider"
                                                    >
                                                        <Smartphone className="w-4 h-4 text-emerald-400" />
                                                        Probar Salón (Exo)
                                                    </a>

                                                    {/* Editar Plan SaaS */}
                                                    <button
                                                        onClick={() => {
                                                            handleOpenEditPlanModal(res);
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="flex items-center gap-3 w-full px-4 py-3 text-amber-400 hover:text-amber-300 hover:bg-slate-900/50 transition-colors text-left text-xs font-bold uppercase tracking-wider"
                                                    >
                                                        <Layers className="w-4 h-4 text-amber-400" />
                                                        Editar Plan SaaS
                                                    </button>



                                                    {/* Editar Restaurante (Subir Logo) */}
                                                    <button
                                                        onClick={() => {
                                                            setLogoModalData({ id: res.id, name: res.name, logo: res.logo_url });
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="flex items-center gap-3 w-full px-4 py-3 text-slate-300 hover:text-white hover:bg-slate-900/50 transition-colors text-left text-xs font-bold uppercase tracking-wider"
                                                    >
                                                        <Upload className="w-4 h-4 text-blue-400" />
                                                        Subir Logo
                                                    </button>

                                                    {/* Asignar Dueño */}
                                                    <button
                                                        onClick={() => {
                                                            setInviteModalData({ id: res.id, name: res.name });
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="flex items-center gap-3 w-full px-4 py-3 text-slate-300 hover:text-white hover:bg-slate-900/50 transition-colors text-left text-xs font-bold uppercase tracking-wider"
                                                    >
                                                        <UserPlus className="w-4 h-4 text-indigo-400" />
                                                        Invitar Dueño
                                                    </button>

                                                    {/* Suspender/Activar */}
                                                    <button
                                                        onClick={() => {
                                                            handleToggleActive(res.id, res.is_active);
                                                            setOpenMenuId(null);
                                                        }}
                                                        className={`flex items-center gap-3 w-full px-4 py-3 hover:bg-slate-900/50 transition-colors text-left text-xs font-bold uppercase tracking-wider
                                                            ${res.is_active 
                                                                ? 'text-yellow-500 hover:text-yellow-400' 
                                                                : 'text-emerald-500 hover:text-emerald-400'
                                                            }`}
                                                    >
                                                        <Power className="w-4 h-4" />
                                                        {res.is_active ? 'Suspender' : 'Activar'}
                                                    </button>

                                                    <div className="h-px bg-slate-800/60 my-1"></div>

                                                    {/* Eliminar (Destructivo) */}
                                                    <button
                                                        onClick={() => {
                                                            setDeleteModalData({ id: res.id, name: res.name });
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="flex items-center gap-3 w-full px-4 py-3 text-red-500 hover:text-red-400 hover:bg-red-950/20 transition-colors text-left text-xs font-bold uppercase tracking-wider"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        Eliminar
                                                    </button>
                                                </div>
                                            )}
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
                            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 col-span-2 flex items-center justify-between">
                                <div>
                                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Plan de Suscripción</p>
                                    <p className="text-xs font-black text-white uppercase flex items-center gap-1.5">
                                        <Layers className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>{res.plan_name || 'Salón & Cocina'}</span>
                                    </p>
                                </div>
                                <span className="text-xs font-mono font-black text-emerald-400">${res.unit_price || 99}/mes</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-bottom duration-300">
                            <button
                                onClick={() => router.push(`/super-admin/restaurants/${res.id}/menu`)}
                                className="col-span-2 py-4 bg-slate-800 hover:bg-emerald-500 hover:text-slate-900 border border-slate-800 hover:border-emerald-500 text-white rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg group"
                            >
                                <ChefHat className="w-4 h-4 text-emerald-500 group-hover:text-inherit" />
                                Gestionar Menú
                            </button>
                            <a
                                href={`/exo/tables?restaurant_id=${res.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="col-span-2 py-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg text-center"
                            >
                                <Smartphone className="w-4 h-4 text-emerald-400" />
                                Probar Salón (Exo Server)
                            </a>
                            <button
                                onClick={() => handleOpenEditPlanModal(res)}
                                className="col-span-2 py-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg"
                            >
                                <Layers className="w-4 h-4" />
                                Editar Plan SaaS
                            </button>
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
                            <button
                                onClick={() => setDeleteModalData({ id: res.id, name: res.name })}
                                className="py-4 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg border border-rose-500/20"
                            >
                                <Trash2 className="w-4 h-4" />
                                Eliminar
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
                    <div className="bg-slate-900 w-full max-w-xl rounded-[3rem] border border-slate-800 shadow-2xl relative animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="p-8 md:p-10 border-b border-slate-800/50 flex justify-between items-center bg-slate-900/50 backdrop-blur-md rounded-t-[3rem] shrink-0">
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

                        <form onSubmit={handleCreateRestaurant} className="p-8 md:p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1">
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

                            {/* Plan de Pago SaaS Selector */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 flex items-center gap-2">
                                        <Layers className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>Plan de Pago SaaS Asignado *</span>
                                    </label>
                                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                                        Suscripción Inicial
                                    </span>
                                </div>

                                <select
                                    value={newRestaurant.plan_id}
                                    onChange={(e) => {
                                        const pId = e.target.value;
                                        const found = plans.find(p => p.id === pId);
                                        setNewRestaurant({
                                            ...newRestaurant,
                                            plan_id: pId,
                                            custom_price: found ? found.monthly_price.toString() : '99'
                                        });
                                    }}
                                    className="w-full px-6 py-5 bg-slate-950 border border-slate-800 rounded-[2rem] focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-white text-xs uppercase tracking-wider"
                                >
                                    {plans.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} — ${p.monthly_price}/mes (Setup: ${p.setup_fee})
                                        </option>
                                    ))}
                                </select>

                                {/* Plan Preview Box */}
                                {(() => {
                                    const selected = plans.find(p => p.id === newRestaurant.plan_id) || plans[0];
                                    if (!selected) return null;
                                    return (
                                        <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-black text-white uppercase italic">{selected.name}</span>
                                                <span className="text-emerald-400 font-black text-sm">${selected.monthly_price}/mes</span>
                                            </div>
                                            <p className="text-[11px] text-slate-400 leading-relaxed">{selected.description}</p>
                                            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800/60 text-[9px] font-black uppercase tracking-wider text-slate-400">
                                                <span className="text-amber-400">Setup: ${selected.setup_fee}</span>
                                                <span>•</span>
                                                <span>{selected.max_screens === 0 ? 'Pantallas ilimitadas' : `${selected.max_screens} pantalla base`}</span>
                                                <span>•</span>
                                                <span className="text-emerald-400">+${selected.extra_screen_price || 10.99}/mes extra</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                                {selected.modules.waitress_exo && (
                                                    <span className="px-2 py-0.5 bg-slate-900 rounded border border-slate-800 text-[9px] font-bold text-amber-400">Meseros</span>
                                                )}
                                                {selected.modules.kds && (
                                                    <span className="px-2 py-0.5 bg-slate-900 rounded border border-slate-800 text-[9px] font-bold text-emerald-400">Cocina KDS</span>
                                                )}
                                                {selected.modules.kiosk && (
                                                    <span className="px-2 py-0.5 bg-slate-900 rounded border border-slate-800 text-[9px] font-bold text-sky-400">Kiosko Touch</span>
                                                )}
                                                {selected.modules.qr_menu && (
                                                    <span className="px-2 py-0.5 bg-slate-900 rounded border border-slate-800 text-[9px] font-bold text-teal-400">Menú QR</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Correo del Dueño / Admin (Invitación Automática) */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 flex items-center gap-2">
                                        <UserPlus className="w-3.5 h-3.5 text-indigo-400" />
                                        <span>Correo del Dueño / Admin (Opcional)</span>
                                    </label>
                                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                                        Invitación Automática
                                    </span>
                                </div>
                                <input
                                    type="email"
                                    value={newRestaurant.owner_email}
                                    onChange={(e) => setNewRestaurant({ ...newRestaurant, owner_email: e.target.value })}
                                    className="w-full px-8 py-5 bg-slate-950 border border-slate-800 rounded-[2rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-black text-white text-sm shadow-inner placeholder:text-slate-800 placeholder:italic placeholder:font-normal"
                                    placeholder="dueno@restaurante.com"
                                />
                                <p className="text-[9px] text-slate-500 font-bold px-2">
                                    Se enviará invitación por correo y se generará enlace directo de activación para WhatsApp.
                                </p>
                            </div>

                            {/* Semilla de Datos de Demostración */}
                            <div 
                                className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center gap-4 cursor-pointer hover:border-slate-700 transition-colors"
                                onClick={() => setNewRestaurant({ ...newRestaurant, seed_demo_data: !newRestaurant.seed_demo_data })}
                            >
                                <input
                                    type="checkbox"
                                    checked={newRestaurant.seed_demo_data}
                                    onChange={(e) => setNewRestaurant({ ...newRestaurant, seed_demo_data: e.target.checked })}
                                    className="w-5 h-5 rounded-lg accent-emerald-500 cursor-pointer"
                                />
                                <div>
                                    <p className="text-xs font-black text-white uppercase tracking-wider">
                                        Inicializar Datos de Demostración (Recomendado)
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                        Crea automáticamente 6 Mesas de Salón (Mesas 1 a 6) y 3 Categorías base (Platos Principales, Bebidas, Postres).
                                    </p>
                                </div>
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
                    initialInviteLink={inviteModalData.initialInviteLink}
                    initialEmail={inviteModalData.initialEmail}
                    initialEmailSent={inviteModalData.initialEmailSent}
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

            {/* Delete Confirmation Modal */}
            {deleteModalData && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-500">
                    <div className="bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-800 shadow-2xl relative animate-in zoom-in-95 duration-300">
                        <button
                            onClick={() => setDeleteModalData(null)}
                            className="absolute top-6 right-6 p-2 hover:bg-slate-800 rounded-full transition-colors"
                        >
                            <CloseIcon className="w-5 h-5 text-slate-400" />
                        </button>

                        <div className="p-8 md:p-10 text-center">
                            <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-rose-500/20">
                                <Trash2 className="w-10 h-10 animate-pulse" />
                            </div>

                            <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none mb-2">
                                ¿Eliminar Restaurante?
                            </h2>
                            <p className="text-slate-500 font-black uppercase tracking-widest text-[9px] mt-1">Esta acción es irreversible</p>

                            <p className="text-slate-300 text-sm font-medium leading-relaxed mb-8 mt-6">
                                ¿Estás completamente seguro de que deseas eliminar permanentemente el restaurante <span className="text-rose-500 font-bold">{deleteModalData.name}</span> del sistema? Se perderán todos los datos vinculados.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <button
                                    onClick={() => setDeleteModalData(null)}
                                    disabled={deleting}
                                    className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 text-[10px] border border-slate-700 disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDeleteRestaurant}
                                    disabled={deleting}
                                    className="flex-1 py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-rose-900/20 transition-all active:scale-95 disabled:opacity-50 text-[10px] flex items-center justify-center gap-2"
                                >
                                    {deleting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Eliminando...</span>
                                        </>
                                    ) : (
                                        <span>Sí, Eliminar</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Editar Plan de Suscripción del Restaurante */}
            {editPlanModalData && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-500">
                    <div className="bg-slate-900 w-full max-w-xl rounded-[3rem] border border-slate-800 shadow-2xl relative animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="p-8 md:p-10 border-b border-slate-800/50 flex justify-between items-center bg-slate-900/50 backdrop-blur-md rounded-t-[3rem] shrink-0">
                            <div>
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block mb-1">
                                    Gestión de Suscripción
                                </span>
                                <h2 className="text-2xl md:text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
                                    Editar Plan: {editPlanModalData.name}
                                </h2>
                            </div>
                            <button
                                onClick={() => setEditPlanModalData(null)}
                                className="p-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl transition-all"
                            >
                                <CloseIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveRestaurantPlan} className="p-8 md:p-10 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
                                    Seleccionar Nuevo Plan
                                </label>
                                <select
                                    value={selectedPlanToEdit}
                                    onChange={(e) => {
                                        const pId = e.target.value;
                                        setSelectedPlanToEdit(pId);
                                        const found = plans.find(p => p.id === pId);
                                        if (found) setEditCustomPrice(found.monthly_price.toString());
                                    }}
                                    className="w-full px-6 py-5 bg-slate-950 border border-slate-800 rounded-2xl text-white font-black text-xs uppercase tracking-wider focus:border-emerald-500 outline-none"
                                >
                                    {plans.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} — ${p.monthly_price}/mes (Setup: ${p.setup_fee})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Plan details preview */}
                            {(() => {
                                const planObj = plans.find(p => p.id === selectedPlanToEdit);
                                if (!planObj) return null;
                                return (
                                    <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-white uppercase">{planObj.name}</span>
                                            <span className="text-emerald-400 font-black text-sm">${planObj.monthly_price}/mes</span>
                                        </div>
                                        <p className="text-[11px] text-slate-400">{planObj.description}</p>
                                        <div className="flex flex-wrap gap-2 pt-2 text-[9px] font-black text-slate-500 uppercase">
                                            <span>Setup: ${planObj.setup_fee}</span>
                                            <span>•</span>
                                            <span>{planObj.max_screens === 0 ? 'Pantallas ilimitadas' : `${planObj.max_screens} pantalla base`}</span>
                                            <span>•</span>
                                            <span className="text-emerald-400">+${planObj.extra_screen_price || 10.99}/mes extra</span>
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
                                    Precio Mensual Facturado (USD/mes)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 font-black text-sm">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={editCustomPrice}
                                        onChange={(e) => setEditCustomPrice(e.target.value)}
                                        className="w-full pl-12 pr-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-white font-black text-sm tracking-wider focus:border-emerald-500 outline-none"
                                        required
                                    />
                                </div>
                                <p className="text-[10px] text-slate-500 px-2">
                                    Puedes ajustar un precio mensual personalizado o mantener la tarifa oficial del plan.
                                </p>
                            </div>

                            <div className="flex gap-4 pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setEditPlanModalData(null)}
                                    className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-xs transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={updatingPlan}
                                    className="flex-[2] py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95"
                                >
                                    {updatingPlan && <Loader2 className="w-4 h-4 animate-spin" />}
                                    <span>{updatingPlan ? 'Actualizando...' : 'Guardar Nuevo Plan'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
