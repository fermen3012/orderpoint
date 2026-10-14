/**
 * Utilidades para impresión térmica ESC/POS mediante RawBT Print Service en Android.
 * Compatible con Google Chrome, Fully Kiosk Browser y navegadores Android WebView.
 */

/**
 * Convierte un Uint8Array a cadena Base64 compatible con navegadores.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return typeof window !== 'undefined' ? window.btoa(binary) : Buffer.from(bytes).toString('base64');
}

/**
 * Intenta enviar datos ESC/POS al WebSocket local de RawBT (ws://127.0.0.1:40213).
 * Este es el método IDEAL para Fully Kiosk Browser, ya que imprime 100% en silencio de fondo
 * sin mostrar ninguna pantalla intermedia ni salir del modo kiosko.
 */
export function printViaRawBTWebSocket(data: Uint8Array, timeoutMs: number = 400): Promise<boolean> {
    return new Promise((resolve) => {
        if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
            resolve(false);
            return;
        }

        const urls = ['ws://127.0.0.1:40213/', 'ws://localhost:40213/'];
        let currentIndex = 0;
        let isDone = false;

        const tryConnect = (url: string) => {
            try {
                const socket = new WebSocket(url);
                socket.binaryType = 'arraybuffer';

                const timer = setTimeout(() => {
                    if (!isDone) {
                        try { socket.close(); } catch {}
                        currentIndex++;
                        if (currentIndex < urls.length) {
                            tryConnect(urls[currentIndex]);
                        } else {
                            isDone = true;
                            resolve(false);
                        }
                    }
                }, timeoutMs);

                socket.onopen = () => {
                    try {
                        socket.send(data.buffer);
                        setTimeout(() => {
                            if (!isDone) {
                                isDone = true;
                                clearTimeout(timer);
                                try { socket.close(); } catch {}
                                resolve(true);
                            }
                        }, 100);
                    } catch {
                        if (!isDone) {
                            isDone = true;
                            clearTimeout(timer);
                            try { socket.close(); } catch {}
                            resolve(false);
                        }
                    }
                };

                socket.onerror = () => {
                    if (!isDone) {
                        clearTimeout(timer);
                        try { socket.close(); } catch {}
                        currentIndex++;
                        if (currentIndex < urls.length) {
                            tryConnect(urls[currentIndex]);
                        } else {
                            isDone = true;
                            resolve(false);
                        }
                    }
                };
            } catch {
                if (!isDone) {
                    currentIndex++;
                    if (currentIndex < urls.length) {
                        tryConnect(urls[currentIndex]);
                    } else {
                        isDone = true;
                        resolve(false);
                    }
                }
            }
        };

        tryConnect(urls[0]);
    });
}

/**
 * Envía datos ESC/POS a RawBT mediante Android Intent URL o URL Scheme.
 * Utiliza un enlace virtual DOM para máxima compatibilidad con Fully Kiosk Browser y Chrome.
 */
export function printViaRawBTIntent(data: Uint8Array): void {
    if (typeof window === 'undefined') return;

    const base64 = uint8ArrayToBase64(data);
    const intentUrl = `intent:base64,${base64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
    const rawbtSchemeUrl = `rawbt:data:application/octet-stream;base64,${base64}`;

    // 1. Si estamos en Fully Kiosk y tiene la interfaz JavaScript habilitada
    const fully = (window as any).fully;
    if (fully) {
        try {
            if (typeof fully.broadcastIntent === 'function') {
                fully.broadcastIntent('ru.a402d.rawbtprinter.action.PRINT', base64);
                console.log('[RawBT] Enviado a través de Fully Kiosk broadcastIntent.');
                return;
            }
        } catch (e) {
            console.debug('[RawBT] Error con fully.broadcastIntent, usando enlaces:', e);
        }
    }

    // 2. Disparar enlace virtual DOM sin cambiar el historial de Fully Kiosk
    try {
        const link = document.createElement('a');
        link.href = intentUrl;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
            try {
                if (link.parentNode) {
                    link.parentNode.removeChild(link);
                }
            } catch {}
        }, 800);
    } catch {
        // Fallback directo por window.location
        window.location.href = rawbtSchemeUrl;
    }
}

/**
 * Función unificada para imprimir en RawBT:
 * 1. Intenta primero el WebSocket local silencioso (0 pantallas intermedias, ideal para Fully Kiosk).
 * 2. Si no responde el socket local, dispara el Intent URL de Android para RawBT.
 */
export async function printWithRawBT(data: Uint8Array): Promise<boolean> {
    try {
        // 1. Intentar impresión silenciosa en segundo plano vía WebSocket (Recomendado para Kioskos)
        const wsSuccess = await printViaRawBTWebSocket(data, 350);
        if (wsSuccess) {
            console.log('[RawBT] Ticket enviado exitosamente vía WebSocket silencioso.');
            return true;
        }

        // 2. Fallback por Android Intent / Scheme
        console.log('[RawBT] WebSocket no activo en RawBT, despachando vía Android Intent.');
        printViaRawBTIntent(data);
        return true;
    } catch (error) {
        console.error('[RawBT] Error al intentar imprimir con RawBT:', error);
        return false;
    }
}
