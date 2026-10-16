'use server';

import { getDynamicStripe, enforceStripeRateLimit, withBillingLock } from '@/lib/stripe';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { requireSameRestaurant, requireRestaurantRole, requireSuperAdmin } from '@/lib/auth/guards';
import { createClient, getAdminClient } from '@/lib/supabase/server';

/**
 * Creates a Stripe Checkout Session for a restaurant subscription.
 */
export async function createCheckoutSession(restaurantId: string) {
    try {
        // 1. Authorize: user must have admin/owner role for the target restaurant
        const profile = await requireRestaurantRole(['admin', 'owner']);

        // Bind restaurantId strictly to the authenticated user's session (unless Super Admin)
        const targetRestaurantId = profile.is_super_admin ? restaurantId : (profile.restaurant_id || '');
        await requireSameRestaurant(targetRestaurantId);

        // 2. Validate input UUID
        if (!targetRestaurantId || !targetRestaurantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            throw new Error('Invalid restaurant ID format');
        }

        // 3. Enforce strict Rate Limiting by IP and User ID to mitigate Card Testing attacks
        const reqHeaders = await headers();
        const forwardedFor = reqHeaders.get('x-forwarded-for');
        const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (reqHeaders.get('x-real-ip') || 'unknown_ip');
        enforceStripeRateLimit(clientIp, profile.id, 5, 10 * 60 * 1000);

        const supabase = await createClient();
        const adminDb = getAdminClient();
        const stripe = await getDynamicStripe();

        // 4. Fetch user email directly from Supabase auth rather than client params
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user || !user.email) {
            throw new Error('User email not found or unauthenticated');
        }

        // 5. Verify restaurant exists and resolve financial parameters strictly from DB / official catalog
        const sessionUrl = await withBillingLock(targetRestaurantId, async () => {
            let restaurant: any = null;
            const { data: restFull, error: restFullErr } = await (adminDb
                .from('restaurants' as any) as any)
                .select('id, name, stripe_customer_id, unit_price, plan_quantity')
                .eq('id', targetRestaurantId)
                .single();

            if (restFullErr || !restFull) {
                const { data: restFallback, error: restError } = await (adminDb
                    .from('restaurants' as any) as any)
                    .select('id, name, stripe_customer_id, plan_quantity')
                    .eq('id', targetRestaurantId)
                    .single();
                if (restError || !restFallback) {
                    throw new Error('Restaurant not found');
                }
                restaurant = restFallback;
            } else {
                restaurant = restFull;
            }

            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            const successUrl = `${appUrl}/admin/billing?success=true`;
            const cancelUrl = `${appUrl}/admin/billing?canceled=true`;

            const dbRest = restaurant as any;
            const quantity = Number.isInteger(Number(dbRest.plan_quantity)) && Number(dbRest.plan_quantity) >= 1
                ? Number(dbRest.plan_quantity)
                : 1;
            const unitPriceDollars = Number(dbRest.unit_price) >= 10 ? Number(dbRest.unit_price) : 99;
            const envPriceId = process.env.STRIPE_PRICE_ID;

            const lineItem = envPriceId && !dbRest.unit_price
                ? { price: envPriceId, quantity }
                : {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `Suscripción Mensual OrderPoint - ${dbRest.name || 'Restaurante'}`,
                        },
                        unit_amount: Math.round(unitPriceDollars * 100),
                        recurring: {
                            interval: 'month' as const,
                        },
                    },
                    quantity,
                };

            const checkoutParams: any = {
                payment_method_types: ['card'],
                line_items: [lineItem],
                mode: 'subscription',
                success_url: successUrl,
                cancel_url: cancelUrl,
                client_reference_id: targetRestaurantId,
                metadata: {
                    restaurantId: targetRestaurantId,
                    userId: profile.id,
                    source: 'orderpoint_checkout'
                },
            };

            if (dbRest.stripe_customer_id) {
                checkoutParams.customer = dbRest.stripe_customer_id;
            } else {
                checkoutParams.customer_email = user.email;
            }

            // 30-second window idempotency key to prevent duplicate session creation from double-clicks
            const timeBucket = Math.floor(Date.now() / 30000);
            const idempotencyKey = `checkout_${targetRestaurantId}_${profile.id}_${timeBucket}`;

            const session = await stripe.checkout.sessions.create(checkoutParams, {
                idempotencyKey,
            });

            if (!session.url) {
                throw new Error('No session URL returned from Stripe');
            }

            return session.url;
        });

        redirect(sessionUrl);
    } catch (error) {
        console.error('Error creating checkout session:', error);
        throw error;
    }
}

/**
 * Creates a Stripe Billing Portal Session for the authenticated restaurant Owner/Admin.
 */
export async function createOwnerPortalSession() {
    try {
        // 1. Authorize role and check restaurant connection
        const profile = await requireRestaurantRole(['admin', 'owner']);
        if (!profile.restaurant_id) {
            throw new Error('Forbidden: No restaurant associated with this profile');
        }

        const supabase = await createClient();
        const stripe = await getDynamicStripe();

        // 2. Fetch the stripe_customer_id directly from the database
        const { data: rest, error: restError } = await (supabase
            .from('restaurants' as any) as any)
            .select('stripe_customer_id')
            .eq('id', profile.restaurant_id)
            .single();

        const dbRest = rest as any;
        if (restError || !dbRest?.stripe_customer_id) {
            throw new Error('No billing customer account found. Please subscribe first.');
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        // 3. Create Portal Session
        const session = await stripe.billingPortal.sessions.create({
            customer: dbRest.stripe_customer_id,
            return_url: `${appUrl}/admin/billing`,
        });

        if (!session.url) {
            throw new Error('No session URL returned from Stripe');
        }

        redirect(session.url);
    } catch (error) {
        console.error('Error creating owner portal session:', error);
        throw error;
    }
}

/**
 * Creates a Stripe Billing Portal Session for a specific restaurant by a Super Admin.
 */
export async function createSuperAdminPortalSession(restaurantId: string) {
    try {
        // 1. Enforce super admin authority
        await requireSuperAdmin();

        // 2. Validate UUID format
        if (!restaurantId || !restaurantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            throw new Error('Invalid restaurant ID format');
        }

        const supabase = getAdminClient();
        const stripe = await getDynamicStripe();

        // 3. Get customer ID
        const { data: rest, error: restError } = await (supabase
            .from('restaurants' as any) as any)
            .select('stripe_customer_id')
            .eq('id', restaurantId)
            .single();

        const dbRest = rest as any;
        if (restError || !dbRest?.stripe_customer_id) {
            throw new Error('No Stripe Customer ID found for the target restaurant.');
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        // 4. Create Portal Session
        const session = await stripe.billingPortal.sessions.create({
            customer: dbRest.stripe_customer_id,
            return_url: `${appUrl}/super-admin/billing`,
        });

        if (!session.url) {
            throw new Error('No session URL returned from Stripe');
        }

        redirect(session.url);
    } catch (error) {
        console.error('Error creating admin portal session:', error);
        throw error;
    }
}
