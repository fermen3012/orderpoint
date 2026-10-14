import { create } from 'zustand';

export type PrinterStatus =
    | 'idle'
    | 'searching'
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'printing'
    | 'error';

interface PrinterStoreState {
    status: PrinterStatus;
    deviceName: string | null;
    errorMessage: string | null;
    isSupported: boolean;
    hasEverPaired: boolean;
    setStatus: (status: PrinterStatus) => void;
    setDeviceName: (name: string | null) => void;
    setErrorMessage: (msg: string | null) => void;
    setIsSupported: (supported: boolean) => void;
    setHasEverPaired: (paired: boolean) => void;
}

const STORAGE_PRINTER_NAME = 'orderpoint_bt_printer_name';
const STORAGE_PRINTER_ID = 'orderpoint_bt_printer_id';

export const usePrinterStore = create<PrinterStoreState>((set) => ({
    status: 'idle',
    deviceName: typeof window !== 'undefined' ? localStorage.getItem(STORAGE_PRINTER_NAME) : null,
    errorMessage: null,
    isSupported: true,
    hasEverPaired: typeof window !== 'undefined' ? !!localStorage.getItem(STORAGE_PRINTER_ID) : false,

    setStatus: (status) => set({ status }),
    setDeviceName: (deviceName) => set({ deviceName }),
    setErrorMessage: (errorMessage) => set({ errorMessage }),
    setIsSupported: (isSupported) => set({ isSupported }),
    setHasEverPaired: (hasEverPaired) => set({ hasEverPaired }),
}));
