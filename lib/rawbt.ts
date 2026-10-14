/**
 * Utilidades para impresión térmica ESC/POS mediante RawBT Print Service en Android.
 * RawBT es el servicio estándar para imprimir tickets en tablets Android vía Bluetooth/USB/Red.
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
 * Si el usuario activó el servidor web en RawBT, imprime en silencio en segundo plano.
 */
export function printViaRawBTWebSocket(data: Uint8Array, timeoutMs: number = 300): Promise<boolean> {
    return new Promise((resolve) => {
        if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
            resolve(false);
            return;
        }

        try {
            const socket = new WebSocket('ws://127.0.0.1:40213/');
            let resolved = false;

            const timer = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    try { socket.close(); } catch {}
                    resolve(false);
                }
            }, timeoutMs);

            socket.binaryType = 'arraybuffer';

            socket.onopen = () => {
                try {
                    socket.send(data.buffer);
                    setTimeout(() => {
                        if (!resolved) {
                            resolved = true;
                            clearTimeout(timer);
                            try { socket.close(); } catch {}
                            resolve(true);
                        }
                    }, 80);
                } catch {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timer);
                        try { socket.close(); } catch {}
                        resolve(false);
                    }
                }
            };

            socket.onerror = () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timer);
                    try { socket.close(); } catch {}
                    resolve(false);
                }
            };
        } catch {
            resolve(false);
        }
    });
}

/**
 * Envía datos ESC/POS a RawBT mediante Android Intent URL o URL Scheme.
 * Este método abre directamente la app RawBT en Android para procesar el ticket.
 */
export function printViaRawBTIntent(data: Uint8Array): void {
    if (typeof window === 'undefined') return;

    const base64 = uint8ArrayToBase64(data);

    // Intent estándar de Chrome para Android dirigido al paquete oficial ru.a402d.rawbtprinter
    const isAndroid = /android/i.test(navigator.userAgent || '');
    
    if (isAndroid) {
        const intentUrl = `intent:base64,${base64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
        window.location.href = intentUrl;
    } else {
        // Fallback para otros navegadores o esquemas directos
        const rawbtUrl = `rawbt:data:application/octet-stream;base64,${base64}`;
        window.location.href = rawbtUrl;
    }
}

/**
 * Función unificada para imprimir en RawBT:
 * 1. Intenta primero el WebSocket local silencioso (0 pantallas intermedias).
 * 2. Si no responde el socket local, dispara el Intent URL de Android para RawBT.
 */
export async function printWithRawBT(data: Uint8Array): Promise<boolean> {
    try {
        // 1. Intentar impresión en segundo plano vía WebSocket de RawBT
        const wsSuccess = await printViaRawBTWebSocket(data, 350);
        if (wsSuccess) {
            console.log('[RawBT] Ticket enviado exitosamente vía WebSocket silencioso.');
            return true;
        }

        // 2. Disparar Intent directo a RawBT
        console.log('[RawBT] WebSocket no disponible, llamando a RawBT vía Android Intent.');
        printViaRawBTIntent(data);
        return true;
    } catch (error) {
        console.error('[RawBT] Error al intentar imprimir con RawBT:', error);
        return false;
    }
}
