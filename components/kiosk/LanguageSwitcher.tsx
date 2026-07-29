'use client';

import { useRouter, usePathname } from '@/i18n/routing';
import { useLocale, useTranslations } from 'next-intl';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher({ className }: { className?: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const locale = useLocale();
    const t = useTranslations('kiosk');

    const toggleLanguage = () => {
        const nextLocale = locale === 'es' ? 'en' : 'es';
        // Preserve search params? The router from next-intl handles this usually?
        // Actually next-intl router might drop search params if not careful.
        // But for simplest toggle, let's use router.replace(pathname, { locale: nextLocale }).
        // If we need to preserve query params (like category_id in menu), we should grab them.
        router.replace(pathname, { locale: nextLocale });
    };

    return (
        <button
            onClick={toggleLanguage}
            className={`flex items-center gap-2 px-6 py-3 bg-white/90 backdrop-blur-md rounded-full border border-slate-200 shadow-lg transition-all hover:bg-white hover:scale-105 active:scale-95 group z-50 ${className}`}
        >
            <Globe className="w-5 h-5 text-slate-500 group-hover:text-primary-500 transition-colors" />
            <span className="text-xs font-black text-slate-700 uppercase tracking-widest group-hover:text-primary-700">
                {t('language', { lang: locale.toUpperCase() })}
            </span>
        </button>
    );
}
