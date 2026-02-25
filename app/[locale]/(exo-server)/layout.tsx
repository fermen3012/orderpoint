import { ReactNode } from 'react';
import ConnectivityIndicator from '@/components/exo/ConnectivityIndicator';

export default function ExoLayout({ children }: { children: ReactNode }) {
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
