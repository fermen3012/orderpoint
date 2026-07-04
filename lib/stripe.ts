import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey && typeof window === 'undefined') {
    console.warn('⚠️ STRIPE_SECRET_KEY is not defined in the environment. Using build fallback.');
}

export const stripe = new Stripe(stripeSecretKey || 'sk_test_placeholder_build', {
    apiVersion: '2026-01-28.clover' as any, // Stable version supported by the local codebase config
    typescript: true,
});
