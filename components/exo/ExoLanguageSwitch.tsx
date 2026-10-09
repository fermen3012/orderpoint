'use client';

import { useRouter, usePathname } from '@/i18n/routing';
import { useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import { Globe } from 'lucide-react';

interface ExoLanguageSwitchProps {
    className?: string;
}

export default function ExoLanguageSwitch({ className }: ExoLanguageSwitchProps) {
    const router = useRouter();
    const pathname = usePathname();
    const locale = useLocale();

    const setLanguage = (newLocale: 'es' | 'en') => {
        if (newLocale === locale) return;
        router.replace(pathname, { locale: newLocale });
    };

    const toggleLanguage = () => {
        const nextLocale = locale === 'es' ? 'en' : 'es';
        router.replace(pathname, { locale: nextLocale });
    };

    return (
        <div
            className={cn(
                "inline-flex items-center bg-slate-800/90 border border-slate-700/80 rounded-2xl p-0.5 shadow-inner backdrop-blur-md transition-all select-none",
                className
            )}
            title={locale === 'es' ? 'Cambiar a Inglés' : 'Switch to Spanish'}
        >
            {/* Botón switch con esquinas redondeadas */}
            <button
                type="button"
                onClick={() => setLanguage('es')}
                className={cn(
                    "px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 active:scale-95",
                    locale === 'es'
                        ? "bg-emerald-500 text-slate-900 shadow-[0_2px_10px_rgba(16,185,129,0.35)]"
                        : "text-slate-400 hover:text-slate-200"
                )}
            >
                ES
            </button>

            <button
                type="button"
                onClick={() => setLanguage('en')}
                className={cn(
                    "px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 active:scale-95",
                    locale === 'en'
                        ? "bg-emerald-500 text-slate-900 shadow-[0_2px_10px_rgba(16,185,129,0.35)]"
                        : "text-slate-400 hover:text-slate-200"
                )}
            >
                EN
            </button>
        </div>
    );
}
