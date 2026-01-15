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
    X,
    ChefHat
} from 'lucide-react';
import { SidebarLink } from '@/components/admin/SidebarLink';

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
    const [authData, setAuthData] = useState<{ userProfile: any, restaurantId: string | null } | null>(null);
    const supabase = createClient();

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                router.push('/login');
                return;
            }

            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (error || !profile) {
                router.push('/login');
                return;
            }

            const profileData = profile as any;

            if (profileData.role !== 'admin' && profileData.role !== 'owner' && !profileData.is_super_admin) {
                router.push('/login');
                return;
            }

            setAuthData({
                userProfile: profileData,
                restaurantId: profileData.restaurant_id
            });
            setLoading(false);
        };
        checkAuth();
    }, [router, supabase]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    if (loading || !authData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    const navigation = [
        { icon: <LayoutDashboard className="w-5 h-5" />, label: t('dashboard'), href: '/admin/dashboard' },
        { icon: <ShoppingBag className="w-5 h-5" />, label: t('orders'), href: '#' },
        { icon: <Package className="w-5 h-5" />, label: t('products'), href: '/admin/products' },
        { icon: <List className="w-5 h-5" />, label: t('categories'), href: '/admin/categories' },
        { icon: <ChefHat className="w-5 h-5" />, label: 'Ingredientes', href: '/admin/ingredients' },
        { icon: <Users className="w-5 h-5" />, label: t('users'), href: '/admin/users' },
    ];

    return (
        <AuthProvider value={authData}>
            <div className="flex min-h-screen bg-slate-50">
                {/* Mobile Sidebar Overlay */}
                {isSidebarOpen && (
                    <div
                        className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}

                {/* Sidebar */}
                <aside className={`
                    fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-100 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
                    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                `}>
                    <div className="flex flex-col h-full">
                        <div className="p-8 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary-500 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-200">
                                    <span className="text-white font-black text-xl">O</span>
                                </div>
                                <span className="text-2xl font-black text-slate-900 tracking-tighter">OrderPoint</span>
                            </div>
                            <button
                                className="lg:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl"
                                onClick={() => setIsSidebarOpen(false)}
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <nav className="flex-1 px-4 space-y-2">
                            {navigation.map((item) => (
                                <SidebarLink
                                    key={item.label}
                                    icon={item.icon}
                                    label={item.label}
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

                        <div className="p-6 mt-auto border-t border-slate-50">
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-3 w-full px-6 py-4 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-2xl transition-all duration-300 font-bold group"
                            >
                                <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                                <span>{t('logout') || 'Cerrar Sesión'}</span>
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-w-0 min-h-screen">
                    {/* Mobile Header */}
                    <header className="lg:hidden bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary-200">
                                <span className="text-white font-black text-sm">O</span>
                            </div>
                            <span className="text-lg font-black text-slate-900 tracking-tighter">OrderPoint</span>
                        </div>
                        <button
                            className="p-2 text-slate-600 bg-slate-50 border border-slate-100 rounded-xl active:scale-95 transition-all"
                            onClick={() => setIsSidebarOpen(true)}
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                    </header>

                    <main className="flex-1 overflow-x-hidden overflow-y-auto">
                        {children}
                    </main>
                </div>
            </div>
        </AuthProvider>
    );
}
