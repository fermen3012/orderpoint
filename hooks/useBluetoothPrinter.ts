'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

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
    connectPrinter: () => Promise<boolean>;
    disconnectPrinter: () => void;
    printBuffer: (data: Uint8Array) => Promise<{ success: boolean; error?: string }>;
}

export function useBluetoothPrinter(): UseBluetoothPrinterReturn {
    const [status, setStatus] = useState<PrinterStatus>('idle');
    const [deviceName, setDeviceName] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSupported, setIsSupported] = useState<boolean>(true);

    const deviceRef = useRef<BluetoothDevice | null>(null);
    const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);

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

    // Manejar evento de desconexión del servidor GATT
    const handleDisconnected = useCallback(() => {
        console.warn('Impresora Bluetooth desconectada.');
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
     * Establece la conexión GATT con un dispositivo Bluetooth previa o recién seleccionado.
     */
    const setupGattConnection = async (device: BluetoothDevice): Promise<boolean> => {
        try {
            setStatus('connecting');
            setErrorMessage(null);

            deviceRef.current = device;
            setDeviceName(device.name || 'Impresora Bluetooth');

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
            return true;
        } catch (err: any) {
            console.error('Error al conectar con la impresora Bluetooth:', err);
            setStatus('error');
            setErrorMessage(err.message || 'Fallo en la conexión GATT con la impresora.');
            return false;
        }
    };

    /**
     * Re-conexión Silenciosa (Auto-reconnect Zero-Dialog):
     * Utiliza navigator.bluetooth.getDevices() para intentar conectar sin abrir diálogo.
     */
    const autoConnect = useCallback(async (): Promise<boolean> => {
        if (typeof window === 'undefined' || !navigator.bluetooth || !navigator.bluetooth.getDevices) {
            return false;
        }

        try {
            setStatus('searching');
            const devices = await navigator.bluetooth.getDevices();

            if (!devices || devices.length === 0) {
                setStatus('disconnected');
                return false;
            }

            // Seleccionar el primer dispositivo autorizado previamente
            const authorizedDevice = devices[0];
            return await setupGattConnection(authorizedDevice);
        } catch (err: any) {
            console.warn('Auto-reconexión silenciosa fallida o denegada:', err);
            setStatus('disconnected');
            return false;
        }
    }, []);

    // Ejecutar intento de auto-reconexión silenciosa al cargar la página en el kiosco
    useEffect(() => {
        if (isSupported) {
            autoConnect();
        }
    }, [isSupported, autoConnect]);

    /**
     * Emparejamiento Manual (Requiere User Gesture / onClick):
     * Solicita la selección de la impresora mostrando el selector estándar del navegador (solo 1 vez).
     */
    const connectPrinter = async (): Promise<boolean> => {
        if (typeof window === 'undefined' || !navigator.bluetooth) {
            setErrorMessage('Web Bluetooth no soportado');
            return false;
        }

        try {
            setStatus('searching');
            setErrorMessage(null);

            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: KNOWN_PRINTER_SERVICES,
            });

            return await setupGattConnection(device);
        } catch (err: any) {
            console.error('Solicitud de dispositivo cancelada o fallida:', err);
            setStatus('disconnected');
            if (err.name !== 'NotFoundError') {
                setErrorMessage(err.message || 'Cancelado por el usuario.');
            }
            return false;
        }
    };

    /**
     * Desconectar impresora activamente
     */
    const disconnectPrinter = () => {
        if (deviceRef.current && deviceRef.current.gatt && deviceRef.current.gatt.connected) {
            deviceRef.current.gatt.disconnect();
        }
        characteristicRef.current = null;
        setStatus('disconnected');
        setDeviceName(null);
    };

    /**
     * Enviar buffer de datos ESC/POS divididos en chunks (MTU ~64 bytes) para evitar desbordamiento BLE
     */
    const printBuffer = async (data: Uint8Array): Promise<{ success: boolean; error?: string }> => {
        if (status !== 'connected' || !characteristicRef.current) {
            // Intentar auto-reconectar si está en estado desconectado
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
            console.error('Error durante la transmisión de impresión:', err);
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
