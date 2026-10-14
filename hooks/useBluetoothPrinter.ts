'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// Claves de persistencia en memoria local
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

export type PrinterStatus =
    | 'idle'
    | 'searching'
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'printing'
    | 'error';

export interface UseBluetoothPrinterReturn {
    status: PrinterStatus;
    deviceName: string | null;
    errorMessage: string | null;
    isSupported: boolean;
    autoConnect: () => Promise<boolean>;
    connectPrinter: (param?: boolean | any) => Promise<boolean>;
    disconnectPrinter: () => void;
    printBuffer: (data: Uint8Array) => Promise<{ success: boolean; error?: string }>;
}

export function useBluetoothPrinter(): UseBluetoothPrinterReturn {
    const [status, setStatus] = useState<PrinterStatus>('idle');
    const [deviceName, setDeviceName] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(STORAGE_PRINTER_NAME);
        }
        return null;
    });
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSupported, setIsSupported] = useState<boolean>(true);

    const deviceRef = useRef<BluetoothDevice | null>(null);
    const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
    const isConnectingRef = useRef<boolean>(false);

    // Comprobar compatibilidad con Web Bluetooth al montar
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const supported = 'bluetooth' in navigator && !!navigator.bluetooth;
            setIsSupported(supported);
            if (!supported) {
                setErrorMessage('Web Bluetooth API no está soportado en este navegador.');
            }
        }
    }, []);

    // Manejar evento de desconexión del servidor GATT (no borra la memoria para permitir reconexión)
    const handleDisconnected = useCallback(() => {
        console.warn('[Bluetooth] Impresora desconectada temporalmente.');
        setStatus('disconnected');
        characteristicRef.current = null;
    }, []);

    /**
     * Busca y configura una característica de escritura válida en el servidor GATT
     */
    const findWritableCharacteristic = async (
        server: BluetoothRemoteGATTServer
    ): Promise<BluetoothRemoteGATTCharacteristic | null> => {
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
    };

    /**
     * Establece la conexión GATT con un dispositivo Bluetooth y guarda sus datos en memoria persistente
     */
    const setupGattConnection = async (device: BluetoothDevice): Promise<boolean> => {
        if (isConnectingRef.current) return false;
        isConnectingRef.current = true;

        try {
            setStatus('connecting');
            setErrorMessage(null);

            deviceRef.current = device;
            const name = device.name || 'Impresora Térmica';
            setDeviceName(name);

            // Guardar permanentemente en memoria local para que persista entre recargas
            if (typeof window !== 'undefined') {
                try {
                    localStorage.setItem(STORAGE_PRINTER_ID, device.id);
                    localStorage.setItem(STORAGE_PRINTER_NAME, name);
                } catch (storeErr) {
                    console.debug('Error guardando en localStorage:', storeErr);
                }
            }

            // Suscribir listener de desconexión
            device.removeEventListener('gattserverdisconnected', handleDisconnected);
            device.addEventListener('gattserverdisconnected', handleDisconnected);

            if (!device.gatt) {
                throw new Error('Servidor GATT no disponible en el dispositivo.');
            }

            // Conectar GATT
            const server = device.gatt.connected
                ? device.gatt
                : await device.gatt.connect();

            // Buscar característica de escritura
            const char = await findWritableCharacteristic(server);

            if (!char) {
                throw new Error('No se encontró una característica de escritura válida en la impresora.');
            }

            characteristicRef.current = char;
            setStatus('connected');
            console.log(`[Bluetooth] Impresora '${name}' conectada y lista.`);
            return true;
        } catch (err: any) {
            console.warn('[Bluetooth] Fallo en la conexión GATT:', err.message || err);
            setStatus('disconnected');
            setErrorMessage(err.message || 'Fallo al conectar con la impresora guardada.');
            return false;
        } finally {
            isConnectingRef.current = false;
        }
    };

    /**
     * Re-conexión Silenciosa en Memoria (Auto-reconnect Zero-Dialog):
     * Utiliza navigator.bluetooth.getDevices() y el ID guardado en localStorage
     * para reconectar automáticamente sin pedir seleccionar la impresora de nuevo.
     */
    const autoConnect = useCallback(async (): Promise<boolean> => {
        if (typeof window === 'undefined' || !navigator.bluetooth || !navigator.bluetooth.getDevices) {
            return false;
        }

        try {
            const devices = await navigator.bluetooth.getDevices();
            if (!devices || devices.length === 0) {
                setStatus('disconnected');
                return false;
            }

            const savedId = localStorage.getItem(STORAGE_PRINTER_ID);
            // Si hay un ID guardado en memoria, reconectar exactamente a ese
            const targetDevice = (savedId ? devices.find((d) => d.id === savedId) : null) || devices[0];

            if (targetDevice) {
                return await setupGattConnection(targetDevice);
            }

            setStatus('disconnected');
            return false;
        } catch (err: any) {
            console.debug('[Bluetooth] Auto-reconexión silenciosa inicial pausada:', err);
            setStatus('disconnected');
            return false;
        }
    }, [handleDisconnected]);

    // Intento 1: Auto-reconexión inmediata al montar la página
    useEffect(() => {
        if (isSupported) {
            autoConnect();
        }
    }, [isSupported, autoConnect]);

    // Intento 2: Reconexión silenciosa al primer toque de pantalla (User Gesture)
    // En Chrome Android, el navegador requiere interacción del usuario para reconectar Bluetooth
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleFirstInteraction = async () => {
            window.removeEventListener('pointerdown', handleFirstInteraction);
            window.removeEventListener('touchstart', handleFirstInteraction);

            // Si aún no está conectado y tenemos una impresora guardada en memoria, reconectar al instante
            if (status !== 'connected' && localStorage.getItem(STORAGE_PRINTER_ID)) {
                await autoConnect();
            }
        };

        window.addEventListener('pointerdown', handleFirstInteraction, { passive: true });
        window.addEventListener('touchstart', handleFirstInteraction, { passive: true });

        return () => {
            window.removeEventListener('pointerdown', handleFirstInteraction);
            window.removeEventListener('touchstart', handleFirstInteraction);
        };
    }, [status, autoConnect]);

    /**
     * Conectar Impresora:
     * Si ya existe un dispositivo guardado en memoria y autorizado, se reconecta en 0 segundos
     * SIN MOSTRAR EL SELECTOR NATIVO. Solo si no hay ninguno o forceNewDialog=true, abre el selector.
     */
    const connectPrinter = async (param?: boolean | any): Promise<boolean> => {
        const forceNewDialog = typeof param === 'boolean' ? param : (param && typeof param === 'object' && 'forceNewDialog' in param ? !!param.forceNewDialog : false);

        if (typeof window === 'undefined' || !navigator.bluetooth) {
            setErrorMessage('Web Bluetooth no soportado');
            return false;
        }

        // 1. Si no se fuerza un nuevo diálogo, intentar reconectar con el dispositivo guardado en memoria
        if (!forceNewDialog && navigator.bluetooth.getDevices) {
            try {
                const devices = await navigator.bluetooth.getDevices();
                const savedId = localStorage.getItem(STORAGE_PRINTER_ID);
                const matched = (savedId ? devices.find((d) => d.id === savedId) : null) || devices[0];

                if (matched) {
                    const connected = await setupGattConnection(matched);
                    if (connected) return true;
                }
            } catch (reconErr) {
                console.debug('[Bluetooth] Intento de reconexión previa:', reconErr);
            }
        }

        // 2. Si no hay dispositivo previo o se solicitó explícitamente, abrir el selector nativo
        try {
            setStatus('searching');
            setErrorMessage(null);

            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: KNOWN_PRINTER_SERVICES,
            });

            return await setupGattConnection(device);
        } catch (err: any) {
            console.warn('[Bluetooth] Selección cancelada o fallida:', err);
            setStatus('disconnected');
            if (err.name !== 'NotFoundError') {
                setErrorMessage(err.message || 'Cancelado por el usuario.');
            }
            return false;
        }
    };

    /**
     * Desconectar y olvidar impresora de la memoria (solo si el usuario lo pide explícitamente)
     */
    const disconnectPrinter = () => {
        if (deviceRef.current && deviceRef.current.gatt && deviceRef.current.gatt.connected) {
            try {
                deviceRef.current.gatt.disconnect();
            } catch {}
        }

        // Limpiar memoria
        if (typeof window !== 'undefined') {
            try {
                localStorage.removeItem(STORAGE_PRINTER_ID);
                localStorage.removeItem(STORAGE_PRINTER_NAME);
            } catch {}
        }

        deviceRef.current = null;
        characteristicRef.current = null;
        setStatus('disconnected');
        setDeviceName(null);
    };

    /**
     * Enviar buffer de datos ESC/POS divididos en chunks (MTU ~64 bytes) para evitar desbordamiento BLE
     */
    const printBuffer = async (data: Uint8Array): Promise<{ success: boolean; error?: string }> => {
        if (status !== 'connected' || !characteristicRef.current) {
            // Intentar auto-reconectar usando el dispositivo guardado en memoria
            const reconnected = await autoConnect();
            if (!reconnected || !characteristicRef.current) {
                return {
                    success: false,
                    error: 'Impresora no conectada. Por favor sincroniza la impresora Bluetooth.',
                };
            }
        }

        const char = characteristicRef.current;
        setStatus('printing');

        try {
            // Tamaño de fragmento BLE seguro para microcontroladores térmicos (64 bytes)
            const CHUNK_SIZE = 64;
            const totalBytes = data.length;

            for (let offset = 0; offset < totalBytes; offset += CHUNK_SIZE) {
                const chunk = data.slice(offset, offset + CHUNK_SIZE);

                if (char.properties.writeWithoutResponse) {
                    await char.writeValueWithoutResponse(chunk);
                } else {
                    await char.writeValueWithResponse(chunk);
                }

                // Pequeña pausa (15ms) entre paquetes para evitar overflow del buffer térmico
                await new Promise((resolve) => setTimeout(resolve, 15));
            }

            setStatus('connected');
            return { success: true };
        } catch (err: any) {
            console.error('[Bluetooth] Error durante la transmisión de impresión:', err);
            setStatus('error');
            setErrorMessage('Error enviando datos a la impresora.');
            return {
                success: false,
                error: err.message || 'Fallo durante la transmisión de datos.',
            };
        }
    };

    return {
        status,
        deviceName,
        errorMessage,
        isSupported,
        autoConnect,
        connectPrinter,
        disconnectPrinter,
        printBuffer,
    };
}
