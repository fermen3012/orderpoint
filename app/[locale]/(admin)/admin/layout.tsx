'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from '@/i18n/routing';
import { AuthProvider } from '@/components/auth/AuthContext';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    ShoppingBag,
    Package,
    List,
    Users,
    LogOut,
    Menu,
    Plus,
    ChefHat,
    CreditCard,
    Calendar,
    Utensils,
    X,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    AlertTriangle,
    QrCode
} from 'lucide-react';
import { SidebarLink } from '@/components/admin/SidebarLink';
import AdminLanguageSwitcher from '@/components/admin/AdminLanguageSwitcher';

export default function ProtectedAdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const t = useTranslations('admin');
    const router = useRouter();
    const pathname = usePathname();
    const [loading, setLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [authData, setAuthData] = useState<{ userProfile: any, restaurantId: string | null } | null>(null);
    const [restaurantName, setRestaurantName] = useState<string | null>(null);
    const [restaurantLogo, setRestaurantLogo] = useState<string | null>(null);
    const [loadingRestaurant, setLoadingRestaurant] = useState(false);
    const [supabase] = useState(() => createClient());

    useEffect(() => {
        let isMounted = true;
        const safetyTimeout = setTimeout(() => {
            if (isMounted) {
                console.warn('AdminLayout: Safety timeout reached during auth check');
                setLoading(false);
                router.push('/login');
            }
        }, 8000);

        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    if (isMounted) router.push('/login');
                    return;
                }

                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single() as { data: any, error: any };

                let profileData = profile as any;

                if (error || !profileData) {
                    const metaRole = session.user.user_metadata?.role || session.user.app_metadata?.role;
                    const metaSuper = Boolean(session.user.user_metadata?.is_super_admin || session.user.app_metadata?.is_super_admin);
                    const metaRestId = session.user.user_metadata?.restaurant_id || null;

                    if (metaRole || metaSuper) {
                        profileData = {
                            id: session.user.id,
                            email: session.user.email,
                            full_name: session.user.user_metadata?.full_name || session.user.email,
                            role: metaRole || 'owner',
                            is_super_admin: metaSuper,
                            restaurant_id: metaRestId
                        };
                    } else {
                        if (isMounted) router.push('/login');
                        return;
                    }
                }

                if (profileData.role !== 'admin' && profileData.role !== 'owner' && !profileData.is_super_admin) {
                    if (isMounted) router.push('/login');
                    return;
                }

                if (isMounted) {
                    setAuthData({
                        userProfile: profileData,
                        restaurantId: profileData.restaurant_id
                    });
                    setLoading(false);
                }
            } catch (err) {
                console.error('AdminLayout: Error checking auth:', err);
                if (isMounted) router.push('/login');
            } finally {
                clearTimeout(safetyTimeout);
            }
        };
        checkAuth();

        return () => {
            isMounted = false;
            clearTimeout(safetyTimeout);
        };
    }, [router, supabase]);

    const [isRestaurantActive, setIsRestaurantActive] = useState<boolean>(true);

    useEffect(() => {
        const fetchRestaurant = async () => {
            if (!authData?.restaurantId) return;
            setLoadingRestaurant(true);
            try {
                const { data, error } = await supabase
                    .from('restaurants')
                    .select('name, logo_url, is_active')
                    .eq('id', authData.restaurantId)
                    .single() as { data: any, error: any };

                if (data && !error) {
                    setRestaurantName(data.name);
                    setRestaurantLogo(data.logo_url);
                    setIsRestaurantActive(data.is_active !== false);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingRestaurant(false);
            }
        };

        if (authData?.restaurantId) {
            fetchRestaurant();
        }
    }, [authData, supabase]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    if (loading || !authData) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 gap-4">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-emerald-500/20 rounded-full animate-ping absolute inset-0"></div>
                    <div className="w-16 h-16 border-t-4 border-emerald-500 rounded-full animate-spin"></div>
                </div>
                <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">{t('startingPanel')}</p>
            </div>
        );
    }

    const navigation = [
        { icon: <LayoutDashboard className="w-5 h-5" />, label: t('dashboard'), href: '/admin/dashboard' },
        { icon: <ShoppingBag className="w-5 h-5" />, label: t('orders'), href: '/admin/orders' },
        { icon: <Package className="w-5 h-5" />, label: t('products'), href: '/admin/products' },
        { icon: <List className="w-5 h-5" />, label: t('categories'), href: '/admin/categories' },
        { icon: <Calendar className="w-5 h-5" />, label: t('schedule'), href: '/admin/schedule' },
        { icon: <ChefHat className="w-5 h-5" />, label: t('ingredients'), href: '/admin/ingredients' },
        { icon: <Utensils className="w-5 h-5" />, label: t('tables'), href: '/admin/tables' },
        { icon: <QrCode className="w-5 h-5" />, label: t('qrMenu'), href: '/admin/billing' },
        { icon: <CreditCard className="w-5 h-5" />, label: t('billing'), href: '/admin/billing' },
        { icon: <Users className="w-5 h-5" />, label: t('users'), href: '/admin/users' },
    ];

    return (
        <AuthProvider value={authData}>
            <div className="flex min-h-screen bg-slate-950 font-sans selection:bg-emerald-500 selection:text-slate-900">
                {/* Mobile Sidebar Overlay */}
                {isSidebarOpen && (
                    <div
                        className="fixed inset-0 bg-slate-950/80 z-40 lg:hidden backdrop-blur-md transition-opacity duration-300"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}

                {/* Sidebar */}
                <aside className={`
                    fixed inset-y-0 left-0 z-50 bg-slate-900/50 backdrop-blur-2xl border-r border-slate-800 transform transition-all duration-500 ease-in-out lg:translate-x-0 lg:static lg:inset-0
                    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                    ${isSidebarCollapsed ? 'w-24' : 'w-72'}
                `}>
                    <div className="flex flex-col h-full">
                        {/* Logo/Header */}
                        <div className={`p-8 flex items-center gap-4 transition-all duration-500 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                                <div className="relative w-10 h-10 bg-slate-800 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-700/50">
                                    {restaurantLogo ? (
                                        <img src={restaurantLogo} alt={restaurantName || ''} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-emerald-500 font-black text-xl">
                                            {restaurantName ? restaurantName.charAt(0).toUpperCase() : 'O'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {!isSidebarCollapsed && (
                                <div className="flex flex-col min-w-0 animate-in fade-in slide-in-from-left duration-500">
                                    {loadingRestaurant ? (
                                        <>
                                            <div className="h-5 w-32 bg-slate-800 animate-pulse rounded-md mb-1"></div>
                                            <div className="h-3 w-20 bg-slate-800/50 animate-pulse rounded-sm"></div>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-lg font-black text-white tracking-tighter truncate leading-none uppercase italic">
                                                {restaurantName || 'OrderPoint'}
                                            </span>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none">
                                                    {t('owner')}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Navigation */}
                        <nav className={`flex-1 px-4 py-4 space-y-1.5 overflow-y-auto no-scrollbar`}>
                            {navigation.map((item) => (
                                <SidebarLink
                                    key={item.label}
                                    icon={item.icon}
                                    label={item.label}
                                    collapsed={isSidebarCollapsed}
                                    active={pathname.includes(item.href) && item.href !== '#'}
                                    onClick={() => {
                                        if (item.href !== '#') {
                                            router.push(item.href);
                                            setIsSidebarOpen(false);
                                        }
                                    }}
                                />
                            ))}
                        </nav>

                        {/* Footer & Collapse Toggle */}
                        <div className="p-4 mt-auto border-t border-slate-800/50 bg-slate-900/30">
                            <button
                                onClick={handleLogout}
                                className={`flex items-center gap-4 w-full px-4 py-4 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-2xl transition-all duration-300 font-black uppercase tracking-widest text-[10px] group ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                            >
                                <LogOut className={`w-5 h-5 transition-transform duration-300 ${isSidebarCollapsed ? '' : 'group-hover:-translate-x-1'}`} />
                                {!isSidebarCollapsed && <span>{t('logout') || 'Cerrar Sesión'}</span>}
                            </button>

                            {/* Desktop Collapse Toggle */}
                            <button
                                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                                className="hidden lg:flex absolute -right-3 top-24 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full items-center justify-center text-slate-400 hover:text-emerald-500 hover:border-emerald-500/50 transition-all shadow-xl z-50 group"
                            >
                                {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-w-0 transition-all duration-500 overflow-hidden">
                    {/* Header */}
                    <header className="bg-slate-950/50 backdrop-blur-xl border-b border-slate-800/50 px-6 py-4 flex items-center justify-between sticky top-0 z-30 h-20">
                        <div className="flex items-center gap-4">
                            <button
                                className="lg:hidden p-3 text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl active:scale-95 transition-all hover:text-emerald-500 hover:border-emerald-500/50"
                                onClick={() => setIsSidebarOpen(true)}
                            >
                                <Menu className="w-6 h-6" />
                            </button>

                            <div className="flex flex-col">
                                <h1 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-emerald-500" />
                                    {navigation.find(n => pathname.includes(n.href) && n.href !== '#')?.label || 'Dashboard'}
                                </h1>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                                    {t('restaurantManagement')}
                                </p>
                            </div>
                        </div>

                        {/* Top Right Actions (can be expanded) */}
                        <div className="flex items-center gap-3">
                            <AdminLanguageSwitcher />
                            <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-slate-900 border border-slate-800 rounded-2xl">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                    {t('syncOk')}
                                </span>
                            </div>
                        </div>
                    </header>

                    <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-950 custom-scrollbar">
                        <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full">
                            {!isRestaurantActive && (
                                <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-[2rem] flex items-start gap-4 mb-6 shadow-2xl animate-in slide-in-from-top-2 duration-300">
                                    <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-black text-white uppercase tracking-widest mb-1">Restaurante Suspendido</h4>
                                        <p className="text-slate-400 font-medium text-xs leading-relaxed font-sans">
                                            Tu cuenta de restaurante ha sido temporalmente suspendida por el administrador del sistema. Los clientes no podrán acceder al Kiosco de autoservicio ni realizar pedidos mientras la suspensión esté activa. Comunícate con el soporte para más información.
                                        </p>
                                    </div>
                                </div>
                            )}
                            {children}
                        </div>
                    </main>
                </div>
            </div>

            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #1e293b;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #334155;
                }
            `}</style>
        </AuthProvider>
    );
}
