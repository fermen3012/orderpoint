import { ReactNode } from 'react';
import ConnectivityIndicator from '@/components/exo/ConnectivityIndicator';
import ExoLanguageSwitch from '@/components/exo/ExoLanguageSwitch';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

export default async function ExoLayout({
    children,
    params
}: {
    children: ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        redirect(`/${locale}/login`);
    }

    const { data: profile, error: profileError } = await (supabase
        .from('profiles') as any)
        .select('role, is_super_admin, full_name, restaurant_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
        redirect(`/${locale}/login`);
    }

    const { role, is_super_admin, restaurant_id } = profile;

    if (role !== 'mesera' && role !== 'admin' && role !== 'owner' && !is_super_admin) {
        redirect(`/${locale}/login`);
    }

    // Kill-Switch: Verificar si el restaurante está suspendido por falta de pago
    if (restaurant_id) {
        const { data: rest } = await (supabase
            .from('restaurants') as any)
            .select('name, is_active')
            .eq('id', restaurant_id)
            .single();

        if (rest && rest.is_active === false && !is_super_admin) {
            return (
                <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center select-none font-sans text-white">
                    <div className="w-24 h-24 bg-rose-500/10 border-2 border-rose-500/30 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-2xl animate-pulse">
                        <AlertTriangle className="w-12 h-12 text-rose-500" />
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500">
                            Salón Suspendido
                        </span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-white italic tracking-tighter uppercase mb-4 max-w-lg">
                        Servicio No Disponible
                    </h1>
                    <p className="text-slate-400 text-sm md:text-base font-medium leading-relaxed max-w-md mb-8">
                        El comandeo de salón para este restaurante ha sido suspendido temporalmente por la administración del sistema. Comunícate con gerencia.
                    </p>
                    <div className="px-6 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {rest.name || 'OrderPoint Exo Server'}
                    </div>
                </div>
            );
        }
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-emerald-500/30">
            {/* Header / Status Bar */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 z-50 px-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                        <span className="font-black text-slate-900">E</span>
                    </div>
                    <h1 className="text-xl font-black uppercase tracking-tighter italic">Exo Server</h1>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                    {profile.full_name && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="font-black text-slate-200 capitalize truncate max-w-[110px] sm:max-w-[180px]">
                                {profile.full_name}
                            </span>
                        </div>
                    )}
                    <ExoLanguageSwitch />
                    <ConnectivityIndicator />
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-20 pb-24 px-4 min-h-screen">
                {children}
            </main>
        </div>
    );
}
