'use client';

import { useEffect, useState } from 'react';
import { Smartphone, Download, X, Sparkles, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PwaInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // 1. Registrar / actualizar Service Worker siempre (incluso en modo standalone) para limpiar versiones antiguas
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then((reg) => {
                reg.update().catch(() => {});
            }).catch((err) => {
                console.debug('[PWA] Service Worker registration failed:', err);
            });
        }

        // 2. Verificar si ya se está ejecutando como PWA instalada (standalone)
        const checkStandalone = () => {
            const isPwa = window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone === true ||
                document.referrer.includes('android-app://');
            setIsStandalone(isPwa);
            return isPwa;
        };

        if (checkStandalone()) return;

        // 3. Detectar si el usuario ya descartó el banner en esta sesión
        const dismissed = sessionStorage.getItem('orderpoint_pwa_dismissed');
        if (dismissed === 'true') return;

        // 4. Detectar si es iOS (iPhone / iPad)
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isAppleDevice);

        if (isAppleDevice && !checkStandalone()) {
            // Mostrar prompt específico para iOS después de 2.5 segundos
            const timer = setTimeout(() => {
                setIsVisible(true);
            }, 2500);
            return () => clearTimeout(timer);
        }

        // 5. Escuchar evento oficial 'beforeinstallprompt' en Android / Chrome / Edge
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            // Mostrar modal tras 1.5 segundos para que la página cargue suavemente
            setTimeout(() => {
                setIsVisible(true);
            }, 1500);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Detectar si la app fue instalada exitosamente
        window.addEventListener('appinstalled', () => {
            setIsVisible(false);
            setDeferredPrompt(null);
            console.log('[PWA] OrderPoint instalado exitosamente como PWA.');
        });

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        try {
            // Mostrar diálogo nativo del navegador
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log('[PWA] Elección de instalación:', outcome);
            setDeferredPrompt(null);
            setIsVisible(false);
        } catch (err) {
            console.error('[PWA] Error durante el prompt de instalación:', err);
        }
    };

    const handleDismiss = () => {
        setIsVisible(false);
        sessionStorage.setItem('orderpoint_pwa_dismissed', 'true');
    };

    if (isStandalone || !isVisible) {
        return null;
    }

    return (
        <div className="fixed bottom-6 left-4 right-4 md:left-auto md:right-8 md:max-w-md z-[9999] animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="relative bg-slate-900/95 backdrop-blur-2xl text-white p-6 rounded-[2.5rem] border border-slate-700/80 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
                {/* Glow decorativo de fondo */}
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-orange-500/20 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

                {/* Botón cerrar */}
                <button
                    onClick={handleDismiss}
                    className="absolute top-5 right-5 p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition active:scale-95"
                    title="Cerrar"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="flex items-start gap-4">
                    {/* Icono de App */}
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/30 shrink-0 rotate-1">
                        <Smartphone className="w-7 h-7" />
                    </div>

                    <div className="flex-1 pr-6">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[10px] font-black uppercase tracking-wider mb-1.5">
                            <Sparkles className="w-3 h-3" />
                            <span>Aplicación Rápida</span>
                        </div>
                        <h4 className="text-lg font-black tracking-tight text-white uppercase italic">
                            ¿Instalar OrderPoint?
                        </h4>
                        <p className="text-slate-300 text-xs mt-1 leading-relaxed font-medium">
                            {isIOS
                                ? "Instala la app en tu iPhone para usar el Kiosko a pantalla completa sin barra de navegación."
                                : "Agrégala a tu teléfono para abrirla al instante en pantalla completa sin barra de navegador."
                            }
                        </p>
                    </div>
                </div>

                {/* Botón de Acción */}
                <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center gap-3">
                    {isIOS ? (
                        <div className="w-full bg-slate-800/90 rounded-2xl p-3 text-xs text-slate-300 flex items-center gap-2 border border-slate-700/60">
                            <Share2 className="w-5 h-5 text-orange-400 shrink-0" />
                            <span>
                                Toca el botón <strong>Compartir</strong> y luego selecciona <strong>"Agregar al inicio" ➕</strong>.
                            </span>
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={handleDismiss}
                                className="px-5 py-3 rounded-2xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition active:scale-95"
                            >
                                Ahora no
                            </button>
                            <button
                                onClick={handleInstallClick}
                                className="flex-1 py-3.5 px-5 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                <span>Instalar App</span>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
