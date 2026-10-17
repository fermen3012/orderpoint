'use client';

import { useEffect } from 'react';

/**
 * AppWatchdog - Componente de Autocuidado
 * 
 * Este componente monitorea la carga inicial de la aplicación.
 * Si detecta que la aplicación no ha renderizado contenido significativo después de un tiempo prudente
 * (pantalla blanca de la muerte), ejecuta una limpieza profunda y recarga la página.
 */
export default function AppWatchdog() {
    useEffect(() => {
        // Solo ejecutar en el cliente
        if (typeof window === 'undefined') return;

        const checkSystemHealth = (isStuckLoaderCheck = false) => {
            // Criterios para determinar si la app está viva:
            // 1. Buscamos elementos semánticos clave o formularios
            const mainElement = document.querySelector('main');
            const roleMain = document.querySelector('[role="main"]');
            const formElement = document.querySelector('form');

            // 2. Verificamos si hay contenido de texto visible (evita falsos positivos con loaders vacíos)
            const bodyText = document.body.innerText.trim();
            const hasVisibleContent = bodyText.length > 20;

            // 3. Verificamos si hay indicadores de carga (spinners)
            const hasLoader = document.querySelector('.animate-spin');

            // Si es el chequeo rápido (10s): falla si pantalla 100% blanca sin loader.
            // Si es el chequeo extendido (18s): falla también si sigue atascado en un spinner sin <main> ni <form>.
            const isCriticalFailure = isStuckLoaderCheck
                ? (!mainElement && !roleMain && !formElement && Boolean(hasLoader || !hasVisibleContent))
                : (!mainElement && !roleMain && !formElement && !hasVisibleContent && !hasLoader);

            if (isCriticalFailure) {
                console.error('🚨 [AppWatchdog] CRITICAL FAILURE DETECTED: Blank or Stuck Loading Screen. Initiating Emergency Reset Protocol.');
                performHardReset();
            } else {
                console.log('✅ [AppWatchdog] System nominal.');
            }
        };

        const performHardReset = async () => {
            // 1. Limpiar Storage (donde suelen vivir tokens corruptos o estados rotos)
            try {
                window.localStorage.clear();
                window.sessionStorage.clear();
                // Limpiar cookies de sesión potencialmente corruptas
                document.cookie.split(';').forEach((c) => {
                    const name = c.split('=')[0]?.trim();
                    if (name && name.startsWith('sb-')) {
                        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
                    }
                });
                console.log('🧹 Storage & auth cookies cleared.');
            } catch (e) {
                console.error('Failed to clear storage', e);
            }

            // 2. Eliminar Service Workers (principal causa de caché corrupto persistente)
            try {
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(registrations.map((reg) => reg.unregister()));
                    console.log('🧹 Service Workers unregistered');
                }
            } catch (e) {
                console.error('Failed to unregister service workers', e);
            }

            // 3. Limpiar Cache Storage API
            try {
                if ('caches' in window) {
                    const names = await caches.keys();
                    await Promise.all(names.map((name) => caches.delete(name)));
                    console.log('🧹 Caches cleared.');
                }
            } catch (e) {
                console.error('Failed to clear caches', e);
            }

            // 4. Redirigir limpio al login
            const currentLocale = window.location.pathname.startsWith('/en') ? 'en' : 'es';
            console.log('🔄 Redirecting to clean login...');
            window.location.href = `/${currentLocale}/login`;
        };

        const watchdogTimer = setTimeout(() => checkSystemHealth(false), 10000);
        const stuckLoaderTimer = setTimeout(() => checkSystemHealth(true), 18000);

        return () => {
            clearTimeout(watchdogTimer);
            clearTimeout(stuckLoaderTimer);
        };
    }, []);

    // Este componente es invisible, un "fantasma en la máquina"
    return null;
}
