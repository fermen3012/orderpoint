import { ReactNode } from 'react';
import ConnectivityIndicator from '@/components/exo/ConnectivityIndicator';
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

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, is_super_admin')
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

                <div className="flex items-center gap-4">
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
