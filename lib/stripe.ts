import Stripe from 'stripe';
import { getAdminClient } from '@/lib/supabase/server';

let cachedStripeInstance: Stripe | null = null;
let cachedKey: string | null = null;

// Fallback static instance for backward compatibility in non-async contexts or build phases
const buildFallbackKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_build';
export const stripe = new Stripe(buildFallbackKey, {
    apiVersion: '2026-01-28.clover' as any,
    typescript: true,
    maxNetworkRetries: 2,
    timeout: 15000,
});

// Sliding-window Rate Limiter (by IP and User ID) to prevent Card Testing & Checkout abuse
const rateLimitStore = new Map<string, number[]>();

export function enforceStripeRateLimit(
    ip: string,
    userId: string,
    maxRequests: number = 5,
    windowMs: number = 10 * 60 * 1000 // 10 minutes default
): void {
    const now = Date.now();
    const keys = [`ip:${ip || 'unknown'}`, `user:${userId || 'anonymous'}`];

    for (const key of keys) {
        const timestamps = (rateLimitStore.get(key) || []).filter(ts => now - ts < windowMs);
        if (timestamps.length >= maxRequests) {
            throw new Error('Too Many Requests: Límite de intentos de pago alcanzado. Por favor espera unos minutos antes de reintentar.');
        }
        timestamps.push(now);
        rateLimitStore.set(key, timestamps);
    }

    // Periodic memory cleanup
    if (rateLimitStore.size > 2000) {
        for (const [k, v] of rateLimitStore.entries()) {
            const active = v.filter(ts => now - ts < windowMs);
            if (active.length === 0) rateLimitStore.delete(k);
            else rateLimitStore.set(k, active);
        }
    }
}

// Per-tenant Concurrency Mutex to prevent race conditions during plan upgrades/downgrades
const activeTenantLocks = new Map<string, Promise<any>>();

export async function withBillingLock<T>(restaurantId: string, operation: () => Promise<T>): Promise<T> {
    const lockKey = `billing_lock_${restaurantId}`;
    const existingLock = activeTenantLocks.get(lockKey);

    if (existingLock) {
        try {
            await existingLock;
        } catch {
            // Ignore previous operation error and acquire lock
        }
    }

    let currentPromise!: Promise<T>;
    currentPromise = (async () => {
        try {
            return await operation();
        } finally {
            if (activeTenantLocks.get(lockKey) === currentPromise) {
                activeTenantLocks.delete(lockKey);
            }
        }
    })();

    activeTenantLocks.set(lockKey, currentPromise);
    return currentPromise;
}

/**
 * Resolves and returns a Stripe client instance dynamically using database configuration,
 * with process.env.STRIPE_SECRET_KEY as a fallback. Supports both Restricted Keys (rk_*) and Secret Keys (sk_*).
 */
export async function getDynamicStripe(): Promise<Stripe> {
    if (typeof window !== 'undefined') {
        throw new Error('getDynamicStripe can only be used on the server-side.');
    }

    try {
        const supabase = getAdminClient();
        const { data, error } = await (supabase
            .from('system_settings' as any) as any)
            .select('value')
            .eq('key', 'stripe_secret_key')
            .single();

        const activeKey = (!error && data?.value && !String(data.value).includes('••••'))
            ? String(data.value).trim()
            : process.env.STRIPE_SECRET_KEY?.trim();
        const resolvedKey = activeKey || 'sk_test_placeholder_build';

        if (cachedStripeInstance && cachedKey === resolvedKey) {
            return cachedStripeInstance;
        }

        cachedKey = resolvedKey;
        cachedStripeInstance = new Stripe(resolvedKey, {
            apiVersion: '2026-01-28.clover' as any,
            typescript: true,
            maxNetworkRetries: 2,
            timeout: 15000,
        });

        return cachedStripeInstance;
    } catch (err) {
        console.error('Error resolving dynamic Stripe key:', err);
        const resolvedKey = process.env.STRIPE_SECRET_KEY?.trim() || 'sk_test_placeholder_build';
        if (cachedStripeInstance && cachedKey === resolvedKey) {
            return cachedStripeInstance;
        }
        cachedKey = resolvedKey;
        cachedStripeInstance = new Stripe(resolvedKey, {
            apiVersion: '2026-01-28.clover' as any,
            typescript: true,
            maxNetworkRetries: 2,
            timeout: 15000,
        });
        return cachedStripeInstance;
    }
}

/**
 * Resolves the Stripe Webhook Secret dynamically from system_settings, with fallback to env.
 */
export async function getDynamicWebhookSecret(): Promise<string | null> {
    if (typeof window !== 'undefined') {
        throw new Error('getDynamicWebhookSecret can only be used on the server-side.');
    }

    try {
        const supabase = getAdminClient();
        const { data, error } = await (supabase
            .from('system_settings' as any) as any)
            .select('value')
            .eq('key', 'stripe_webhook_secret')
            .single();

        if (!error && data?.value && !String(data.value).includes('••••')) {
            return String(data.value).trim();
        }
        return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
    } catch {
        return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
    }
}
