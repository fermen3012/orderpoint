import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatPrice(price: number, locale: string = 'es-SV'): string {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
    }).format(price)
}

export function formatOrderNumber(orderNumber: number): string {
    return `#${String(orderNumber).padStart(4, '0')}`
}

export function getLocalizedValue(field: any, currentLang: string = 'es'): string {
    if (!field) return '';
    let current = field;
    for (let i = 0; i < 5; i++) {
        if (typeof current === 'string') {
            const trimmed = current.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (parsed !== null && parsed !== undefined) {
                        current = parsed;
                        continue;
                    }
                } catch {
                    try {
                        const fixed = trimmed.replace(/""/g, '"');
                        const parsed = JSON.parse(fixed);
                        if (parsed !== null && parsed !== undefined) {
                            current = parsed;
                            continue;
                        }
                    } catch {}
                }
            }
            break;
        } else if (current && typeof current === 'object') {
            const foundKey = Object.keys(current).find(pk => pk.toLowerCase() === (currentLang || 'es').toLowerCase());
            if (foundKey) {
                current = current[foundKey];
            } else {
                const esKey = Object.keys(current).find(pk => pk.toLowerCase() === 'es');
                if (esKey) {
                    current = current[esKey];
                } else {
                    const firstKey = Object.keys(current)[0];
                    current = firstKey ? current[firstKey] : '';
                }
            }
        } else {
            break;
        }
    }
    return typeof current === 'string' ? current : (current ? String(current) : '');
}

export function generateUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        try {
            return crypto.randomUUID();
        } catch {
            // Fallback if invocation fails in certain webviews
        }
    }
    // Safe standard RFC4122 v4 UUID fallback for non-secure contexts (e.g. mobile over HTTP)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
