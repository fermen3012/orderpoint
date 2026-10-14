'use client';

import { useEffect, useCallback } from 'react';
import { usePrinterStore, PrinterStatus } from '@/store/printer-store';

// Claves de persistencia en almacenamiento local
const STORAGE_PRINTER_ID = 'orderpoint_bt_printer_id';
const STORAGE_PRINTER_NAME = 'orderpoint_bt_printer_name';

// UUIDs de servicios de impresoras térmicas Bluetooth más comunes (SPP / Custom Thermal Services)
const KNOWN_PRINTER_SERVICES = [
    '000018f0-0000-1000-8000-00023093c0e0', // Servicio estándar POS
    '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Servicio ISSC Transparent TX
    '0000e0ff-0000-1000-8000-00023093c0e0', // Servicio alternativo
    '0000ff00-0000-1000-8000-00023093c0e0', // Servicio serie genérico
    '00001101-0000-1000-8000-00023093c0e0', // Serial Port Profile (SPP)
];

// ============================================================================
// SINGLETON GLOBAL EN MEMORIA JAVASCRIPT
// Estas referencias persisten durante TODA la navegación entre rutas (/menu, /categories, etc.)
// ============================================================================
let globalDevice: BluetoothDevice | null = null;
let globalCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
let isConnectingGlobal = false;
let globalListenerAttached = false;

export interface UseBluetoothPrinterReturn {
    status: PrinterStatus;
    deviceName: string | null;
    errorMessage: string | null;
    isSupported: boolean;
    hasEverPaired: boolean;
    autoConnect: () => Promise<boolean>;
    connectPrinter: (param?: boolean | any) => Promise<boolean>;
    disconnectPrinter: () => void;
    printBuffer: (data: Uint8Array) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Busca y configura una característica de escritura válida en el servidor GATT
 */
async function findWritableCharacteristic(
    server: BluetoothRemoteGATTServer
): Promise<BluetoothRemoteGATTCharacteristic | null> {
    try {
        const services = await server.getPrimaryServices();

        for (const service of services) {
            try {
                const characteristics = await service.getCharacteristics();
                for (const char of characteristics) {
                    if (char.properties.write || char.properties.writeWithoutResponse) {
                        return char;
                    }
                }
            } catch (e) {
                console.debug(`No se pudieron obtener características del servicio ${service.uuid}`, e);
            }
        }
    } catch (error) {
        console.error('Error al explorar servicios GATT:', error);
    }
    return null;
}

/**
 * Establece la conexión física GATT con un dispositivo Bluetooth y lo mantiene vivo en el singleton
 */
async function setupGattConnection(device: BluetoothDevice): Promise<boolean> {
    if (isConnectingGlobal) return false;
    isConnectingGlobal = true;

    const store = usePrinterStore.getState();

    try {
        store.setStatus('connecting');
        store.setErrorMessage(null);

        globalDevice = device;
        const name = device.name || localStorage.getItem(STORAGE_PRINTER_NAME) || 'Impresora Térmica';
        store.setDeviceName(name);

        // Guardar permanentemente en localStorage
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(STORAGE_PRINTER_ID, device.id);
                localStorage.setItem(STORAGE_PRINTER_NAME, name);
                store.setHasEverPaired(true);
            } catch {}
        }

        // Listener de desconexión sin destruir el objeto device de memoria
        const onDisconnected = () => {
            console.warn('[Bluetooth] Impresora desconectada físicamente del servidor GATT.');
            globalCharacteristic = null;
            usePrinterStore.getState().setStatus('disconnected');
        };

        device.removeEventListener('gattserverdisconnected', onDisconnected);
        device.addEventListener('gattserverdisconnected', onDisconnected);

        if (!device.gatt) {
            throw new Error('Servidor GATT no disponible en el dispositivo.');
        }

        // Conectar GATT
        const server = device.gatt.connected ? device.gatt : await device.gatt.connect();

        // Buscar característica de escritura
        const char = await findWritableCharacteristic(server);

        if (!char) {
            throw new Error('No se encontró una característica de escritura válida en la impresora.');
        }

        globalCharacteristic = char;
        store.setStatus('connected');
        console.log(`[Bluetooth] Impresora '${name}' conectada y lista.`);
        return true;
    } catch (err: any) {
        console.warn('[Bluetooth] Fallo en la conexión GATT:', err.message || err);
        store.setStatus('disconnected');
        store.setErrorMessage(err.message || 'Fallo al conectar con la impresora guardada.');
        return false;
    } finally {
        isConnectingGlobal = false;
    }
}

/**
 * Reconexión silenciosa sin abrir diálogo de selección
 */
async function attemptAutoConnect(): Promise<boolean> {
    if (typeof window === 'undefined' || !navigator.bluetooth) {
        return false;
    }

    // 1. Si ya tenemos el dispositivo en memoria del singleton, reconectar directamente
    if (globalDevice) {
        if (globalDevice.gatt?.connected && globalCharacteristic) {
            usePrinterStore.getState().setStatus('connected');
            return true;
        }
        return await setupGattConnection(globalDevice);
    }

    // 2. Si no está en memoria RAM, buscar en los dispositivos previamente autorizados por el navegador
    if (navigator.bluetooth.getDevices) {
        try {
            const devices = await navigator.bluetooth.getDevices();
            if (devices && devices.length > 0) {
                const savedId = localStorage.getItem(STORAGE_PRINTER_ID);
                const target = (savedId ? devices.find((d) => d.id === savedId) : null) || devices[0];
                if (target) {
                    return await setupGattConnection(target);
                }
            }
        } catch (err) {
            console.debug('[Bluetooth] getDevices error:', err);
        }
    }

    return false;
}

export function useBluetoothPrinter(): UseBluetoothPrinterReturn {
    const status = usePrinterStore((state) => state.status);
    const deviceName = usePrinterStore((state) => state.deviceName);
    const errorMessage = usePrinterStore((state) => state.errorMessage);
    const isSupported = usePrinterStore((state) => state.isSupported);
    const hasEverPaired = usePrinterStore((state) => state.hasEverPaired);

    // Comprobar soporte inicial al montar
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const supported = 'bluetooth' in navigator && !!navigator.bluetooth;
            usePrinterStore.getState().setIsSupported(supported);
        }
    }, []);

    // Sincronizar estado con el singleton existente al navegar entre páginas
    useEffect(() => {
        if (globalDevice && globalDevice.gatt?.connected && globalCharacteristic) {
            usePrinterStore.getState().setStatus('connected');
            if (globalDevice.name) {
                usePrinterStore.getState().setDeviceName(globalDevice.name);
            }
            return;
        }

        // Si hay una impresora guardada en localStorage, intentar auto-conectar
        if (isSupported && localStorage.getItem(STORAGE_PRINTER_ID)) {
            attemptAutoConnect();
        }
    }, [isSupported]);

    // Listener global de interacción de usuario (para sortear restricciones de Chrome Android)
    useEffect(() => {
        if (typeof window === 'undefined' || globalListenerAttached) return;
        globalListenerAttached = true;

        const handleUserGesture = async () => {
            if (usePrinterStore.getState().status !== 'connected' && localStorage.getItem(STORAGE_PRINTER_ID)) {
                await attemptAutoConnect();
            }
        };

        window.addEventListener('pointerdown', handleUserGesture, { passive: true });
        window.addEventListener('touchstart', handleUserGesture, { passive: true });

        return () => {
            // No removemos el listener para que proteja toda la navegación
        };
    }, []);

    const autoConnect = useCallback(async (): Promise<boolean> => {
        return await attemptAutoConnect();
    }, []);

    /**
     * Conectar Impresora:
     * Si ya se autorizó una vez o está en memoria, reconecta al instante en 0 segundos
     * SIN MOSTRAR LA VENTANA DE SELECCIÓN. Solo si no existe ningún dispositivo, abre el diálogo.
     */
    const connectPrinter = useCallback(async (param?: boolean | any): Promise<boolean> => {
        const forceNewDialog = typeof param === 'boolean'
            ? param
            : (param && typeof param === 'object' && 'forceNewDialog' in param ? !!param.forceNewDialog : false);

        if (typeof window === 'undefined' || !navigator.bluetooth) {
            usePrinterStore.getState().setErrorMessage('Web Bluetooth no soportado');
            return false;
        }

        // 1. Si no se fuerza nuevo diálogo, intentar reconectar con la instancia en memoria
        if (!forceNewDialog) {
            const reconnected = await attemptAutoConnect();
            if (reconnected) return true;
        }

        // 2. Abrir selector nativo de Bluetooth (solo la primera vez o si se fuerza)
        try {
            usePrinterStore.getState().setStatus('searching');
            usePrinterStore.getState().setErrorMessage(null);

            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: KNOWN_PRINTER_SERVICES,
            });

            return await setupGattConnection(device);
        } catch (err: any) {
            console.warn('[Bluetooth] Selección cancelada o fallida:', err);
            usePrinterStore.getState().setStatus('disconnected');
            if (err.name !== 'NotFoundError') {
                usePrinterStore.getState().setErrorMessage(err.message || 'Cancelado por el usuario.');
            }
            return false;
        }
    }, []);

    /**
     * Desconectar y borrar de memoria
     */
    const disconnectPrinter = useCallback(() => {
        if (globalDevice && globalDevice.gatt && globalDevice.gatt.connected) {
            try {
                globalDevice.gatt.disconnect();
            } catch {}
        }

        if (typeof window !== 'undefined') {
            try {
                localStorage.removeItem(STORAGE_PRINTER_ID);
                localStorage.removeItem(STORAGE_PRINTER_NAME);
            } catch {}
        }

        globalDevice = null;
        globalCharacteristic = null;
        const store = usePrinterStore.getState();
        store.setStatus('disconnected');
        store.setDeviceName(null);
        store.setHasEverPaired(false);
    }, []);

    /**
     * Enviar buffer de datos ESC/POS divididos en chunks (MTU ~64 bytes)
     */
    const printBuffer = useCallback(async (data: Uint8Array): Promise<{ success: boolean; error?: string }> => {
        if (usePrinterStore.getState().status !== 'connected' || !globalCharacteristic) {
            // Intentar auto-reconectar con el dispositivo en memoria
            const reconnected = await attemptAutoConnect();
            if (!reconnected || !globalCharacteristic) {
                return {
                    success: false,
                    error: 'Impresora no conectada. Por favor sincroniza la impresora Bluetooth.',
                };
            }
        }

        const char = globalCharacteristic;
        usePrinterStore.getState().setStatus('printing');

        try {
            const CHUNK_SIZE = 64;
            const totalBytes = data.length;

            for (let offset = 0; offset < totalBytes; offset += CHUNK_SIZE) {
                const chunk = data.slice(offset, offset + CHUNK_SIZE);

                if (char.properties.writeWithoutResponse) {
                    await char.writeValueWithoutResponse(chunk);
                } else {
                    await char.writeValueWithResponse(chunk);
                }

                // Pausa de 15ms entre paquetes para evitar overflow del buffer térmico
                await new Promise((resolve) => setTimeout(resolve, 15));
            }

            usePrinterStore.getState().setStatus('connected');
            return { success: true };
        } catch (err: any) {
            console.error('[Bluetooth] Error durante la transmisión de impresión:', err);
            usePrinterStore.getState().setStatus('error');
            usePrinterStore.getState().setErrorMessage('Error enviando datos a la impresora.');
            return {
                success: false,
                error: err.message || 'Fallo durante la transmisión de datos.',
            };
        }
    }, []);

    return {
        status,
        deviceName,
        errorMessage,
        isSupported,
        hasEverPaired,
        autoConnect,
        connectPrinter,
        disconnectPrinter,
        printBuffer,
    };
}
