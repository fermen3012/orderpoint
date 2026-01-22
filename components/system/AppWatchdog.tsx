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

        const checkSystemHealth = () => {
            // Criterios para determinar si la app está viva:
            // 1. Buscamos elementos semánticos clave
            const mainElement = document.querySelector('main');
            const roleMain = document.querySelector('[role="main"]');

            // 2. Verificamos si hay contenido de texto visible (evita falsos positivos con loaders vacíos)
            // Filtramos scripts y estilos para leer solo texto visible
            const bodyText = document.body.innerText.trim();
            const hasVisibleContent = bodyText.length > 20; // Umbral bajo pero seguro

            // 3. Verificamos si hay indicadores de carga (spinners)
            // Si hay un spinner, la app está funcionando (cargando), no está muerta.
            const hasLoader = document.querySelector('.animate-spin');

            // Si no encontramos estructura NI contenido visible NI loader... Houston, tenemos un problema.
            const isCriticalFailure = !mainElement && !roleMain && !hasVisibleContent && !hasLoader;

            if (isCriticalFailure) {
                console.error('🚨 [AppWatchdog] CRITICAL FAILURE DETECTED: White Screen. Initiating Emergency Reset Protocol.');
                performHardReset();
            } else {
                console.log('✅ [AppWatchdog] System nominal.');
            }
        };

        const performHardReset = () => {
            // 1. Limpiar Storage (donde suelen vivir tokens corruptos o estados rotos)
            try {
                window.localStorage.clear();
                window.sessionStorage.clear();
                console.log('🧹 Storage cleared.');
            } catch (e) {
                console.error('Failed to clear storage', e);
            }

            // 2. Eliminar Service Workers (principal causa de caché corrupto persistente)
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then((registrations) => {
                    for (const registration of registrations) {
                        registration.unregister().then(() => console.log('🧹 Service Worker unregistered'));
                    }
                });
            }

            // 3. Limpiar Cache Storage API
            if ('caches' in window) {
                caches.keys().then((names) => {
                    names.forEach((name) => {
                        caches.delete(name);
                    });
                    console.log('🧹 Caches cleared.');
                });
            }

            // 4. Recarga Forzada desde el Servidor
            // Usamos window.location.reload() que es el estándar.
            // Para asegurar que no sea caché del navegador, podríamos manipular la URL,
            // pero reload() suele ser suficiente en navegadores modernos para re-fetch.
            console.log('🔄 Reloading system...');
            window.location.reload();
        };

        // Esperamos 15 segundos (aumentado de 7s) para dar tiempo a cargas lentas, arranques en frío o conexiones inestables
        const watchdogTimer = setTimeout(checkSystemHealth, 15000);

        // Cleanup si el componente se desmonta (ej: navegación exitosa a otra ruta que desmonte este layout, aunque raro en root layout)
        return () => clearTimeout(watchdogTimer);
    }, []);

    // Este componente es invisible, un "fantasma en la máquina"
    return null;
}
