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
