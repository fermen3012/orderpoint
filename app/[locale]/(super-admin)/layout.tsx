'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Building2,
    Users,
    Settings,
    LogOut,
    ShieldCheck
} from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { useRouter, Link } from '@/i18n/routing';

export default function SuperAdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/login');
    };

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div className="flex min-h-screen bg-[#F8FAFC]">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Dark Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-72 bg-[#0F172A] transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                flex flex-col shadow-2xl
            `}>
                <div className="p-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-500 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/50">
                            <span className="text-white font-black text-xl">O</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xl font-black text-white tracking-tighter leading-none">OrderPoint</span>
                            <span className="text-[10px] font-black text-primary-400 uppercase tracking-widest mt-1">Super Admin</span>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
                    <div className="px-4 mb-4">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Management</p>
                    </div>

                    <SidebarLink
                        icon={<LayoutDashboard className="w-5 h-5" />}
                        label="Dashboard"
                        href="/super-admin/dashboard"
                        active={pathname.includes('/super-admin/dashboard') || pathname.endsWith('/super-admin')}
                        onClick={() => setIsSidebarOpen(false)}
                    />
                    <SidebarLink
                        icon={<Building2 className="w-5 h-5" />}
                        label="Restaurantes"
                        href="/super-admin/restaurants"
                        active={pathname.includes('/super-admin/restaurants')}
                        onClick={() => setIsSidebarOpen(false)}
                    />
                    <SidebarLink
                        icon={<Users className="w-5 h-5" />}
                        label="Usuarios Globales"
                        href="#"
                        onClick={() => setIsSidebarOpen(false)}
                    />

                    <div className="px-4 mb-4 mt-10">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">System</p>
                    </div>
                    <SidebarLink
                        icon={<ShieldCheck className="w-5 h-5" />}
                        label="Seguridad"
                        href="#"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                    <SidebarLink
                        icon={<Settings className="w-5 h-5" />}
                        label="Configuración"
                        href="#"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                </nav>

                <div className="p-6 mt-auto border-t border-slate-800/50 bg-slate-900/50">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-6 py-4 text-slate-400 hover:bg-red-500/10 hover:text-red-500 rounded-2xl transition-all duration-300 font-bold group"
                    >
                        <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span>Salir del Panel</span>
                    </button>
                </div>
            </aside>

            {/* Content Wrapper */}
            <div className="flex-1 flex flex-col min-w-0 min-h-screen">
                {/* Mobile Header */}
                <header className="lg:hidden bg-[#0F172A] px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-lg">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-500 rounded-xl flex items-center justify-center">
                            <span className="text-white font-black text-sm">O</span>
                        </div>
                        <span className="text-lg font-black text-white tracking-tighter">OrderPoint</span>
                    </div>
                    <button
                        className="p-2 text-slate-400 bg-slate-800/50 border border-slate-700/50 rounded-xl active:scale-95 transition-all"
                        onClick={() => setIsSidebarOpen(true)}
                    >
                        <ShieldCheck className="w-6 h-6" /> {/* Using ShieldCheck as a menu icon alternative or just Menu if I import it */}
                    </button>
                </header>

                <main className="flex-1 overflow-x-hidden overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}

function SidebarLink({ icon, label, href, active = false, onClick }: { icon: React.ReactNode, label: string, href: string, active?: boolean, onClick?: () => void }) {
    return (
        <Link
            href={href as any}
            onClick={onClick}
            className={`flex items-center gap-4 w-full px-6 py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all duration-300 ${active
                ? 'bg-primary-500 text-white shadow-xl shadow-primary-500/20'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                }`}>
            {icon}
            <span>{label}</span>
        </Link>
    );
}
