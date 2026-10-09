import { ReactNode } from 'react';
import ConnectivityIndicator from '@/components/exo/ConnectivityIndicator';
import ExoLanguageSwitch from '@/components/exo/ExoLanguageSwitch';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

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
        .select('role, is_super_admin, full_name')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
        redirect(`/${locale}/login`);
    }

    const { role, is_super_admin } = profile;

    if (role !== 'mesera' && role !== 'admin' && role !== 'owner' && !is_super_admin) {
        redirect(`/${locale}/login`);
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
