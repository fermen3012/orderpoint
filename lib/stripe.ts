import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

let cachedStripeInstance: Stripe | null = null;
let cachedKey: string | null = null;

// Fallback static instance for backward compatibility in non-async contexts or build phases
const buildFallbackKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_build';
export const stripe = new Stripe(buildFallbackKey, {
    apiVersion: '2026-01-28.clover' as any,
    typescript: true,
});

/**
 * Resolves and returns a Stripe client instance dynamically using database configuration,
 * with process.env.STRIPE_SECRET_KEY as a fallback.
 */
export async function getDynamicStripe(): Promise<Stripe> {
    if (typeof window !== 'undefined') {
        throw new Error('getDynamicStripe can only be used on the server-side.');
    }

    try {
        const supabase = await createClient();
        const { data, error } = await (supabase
            .from('system_settings' as any) as any)
            .select('value')
            .eq('key', 'stripe_secret_key')
            .single();

        const activeKey = (!error && data?.value) ? data.value : process.env.STRIPE_SECRET_KEY;
        const resolvedKey = activeKey || 'sk_test_placeholder_build';

        if (cachedStripeInstance && cachedKey === resolvedKey) {
            return cachedStripeInstance;
        }

        cachedKey = resolvedKey;
        cachedStripeInstance = new Stripe(resolvedKey, {
            apiVersion: '2026-01-28.clover' as any,
            typescript: true,
        });

        return cachedStripeInstance;
    } catch (err) {
        console.error('Error resolving dynamic Stripe key:', err);
        const resolvedKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_build';
        if (cachedStripeInstance && cachedKey === resolvedKey) {
            return cachedStripeInstance;
        }
        cachedKey = resolvedKey;
        cachedStripeInstance = new Stripe(resolvedKey, {
            apiVersion: '2026-01-28.clover' as any,
            typescript: true,
        });
        return cachedStripeInstance;
    }
}
