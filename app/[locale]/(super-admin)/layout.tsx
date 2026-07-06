'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Building2,
    Users,
    Settings,
    LogOut,
    ShieldCheck,
    Activity,
    Menu,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    CreditCard,
    X
} from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from '@/i18n/routing';
import { SidebarLink } from '@/components/admin/SidebarLink';

export default function SuperAdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/login');
    };

    const navigation = [
        { icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard', href: '/super-admin/dashboard' },
        { icon: <Building2 className="w-5 h-5" />, label: 'Restaurantes', href: '/super-admin/restaurants' },
        { icon: <Users className="w-5 h-5" />, label: 'Usuarios', href: '/super-admin/users' },
        { icon: <CreditCard className="w-5 h-5" />, label: 'Facturación', href: '/super-admin/billing' },
        { icon: <Activity className="w-5 h-5" />, label: 'Sistema', href: '/super-admin/performance' },
        { icon: <Settings className="w-5 h-5" />, label: 'Configuraciones', href: '/super-admin/settings' },
    ];

    return (
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
                fixed inset-y-0 left-0 z-50 bg-slate-900/50 backdrop-blur-2xl border-r border-slate-800 transform transition-all duration-500 ease-in-out lg:translate-x-0 lg:relative lg:inset-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                ${isSidebarCollapsed ? 'lg:w-24 w-72' : 'w-72'}
            `}>
                <div className="flex flex-col h-full">
                    {/* Logo/Header */}
                    <div className={`p-8 flex items-center justify-between gap-4 transition-all duration-500 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                        <div className="flex items-center gap-4">
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                                <div className="relative w-10 h-10 bg-slate-800 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-700/50">
                                    <span className="text-emerald-500 font-black text-xl">
                                        O
                                    </span>
                                </div>
                            </div>

                            {!isSidebarCollapsed && (
                                <div className="flex flex-col min-w-0 animate-in fade-in slide-in-from-left duration-500">
                                    <span className="text-lg font-black text-white tracking-tighter truncate leading-none uppercase italic">
                                        OrderPoint
                                    </span>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none">
                                            Super Admin
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Mobile Close Button */}
                        {isSidebarOpen && (
                            <button
                                onClick={() => setIsSidebarOpen(false)}
                                className="lg:hidden p-2 text-slate-400 hover:text-emerald-500 bg-slate-800/50 border border-slate-700/50 rounded-xl transition-colors active:scale-95"
                                title="Cerrar menú"
                            >
                                <X className="w-4 h-4" />
                            </button>
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
                            {!isSidebarCollapsed && <span>Cerrar Sesión</span>}
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
                                {navigation.find(n => pathname.includes(n.href) && n.href !== '#')?.label || 'Super Admin Panel'}
                            </h1>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1 hidden sm:block">Control Total de Plataforma</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block mr-2">
                            <p className="text-xs font-black text-white tracking-widest uppercase">Raíz del Sistema</p>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Autorizado</p>
                        </div>
                        <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden">
                            <ShieldCheck className="w-5 h-5 text-emerald-500" />
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-950 custom-scrollbar">
                    <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
