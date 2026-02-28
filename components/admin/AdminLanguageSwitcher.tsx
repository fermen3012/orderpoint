'use client';

import { useRouter, usePathname } from '@/i18n/routing';
import { useLocale } from 'next-intl';
import { Globe } from 'lucide-react';

export default function AdminLanguageSwitcher({ className = '' }: { className?: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const locale = useLocale();

    const toggleLanguage = () => {
        const nextLocale = locale === 'es' ? 'en' : 'es';
        router.replace(pathname, { locale: nextLocale });
    };

    return (
        <button
            onClick={toggleLanguage}
            className={`flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-2xl transition-all hover:border-emerald-500/50 hover:text-emerald-500 group ${className}`}
            title={locale === 'es' ? 'Cambiar a Inglés' : 'Switch to Spanish'}
        >
            <Globe className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-emerald-500 leading-none">
                {locale.toUpperCase()}
            </span>
        </button>
    );
}
