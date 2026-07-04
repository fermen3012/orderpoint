'use server';

import { stripe } from '@/lib/stripe';
import { redirect } from 'next/navigation';
import { requireSameRestaurant, requireRestaurantRole, requireProfile } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

/**
 * Creates a Stripe Checkout Session for a restaurant subscription.
 */
export async function createCheckoutSession(restaurantId: string) {
    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error('CRITICAL CONFIGURATION ERROR: STRIPE_SECRET_KEY is not defined.');
        }

        // 1. Authorize: user must have admin/owner role for the target restaurant
        const profile = await requireRestaurantRole(['admin', 'owner']);
        await requireSameRestaurant(restaurantId);

        // 2. Validate input UUID
        if (!restaurantId || !restaurantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            throw new Error('Invalid restaurant ID format');
        }

        const supabase = await createClient();

        // 3. Fetch user email directly from Supabase auth rather than client params
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user || !user.email) {
            throw new Error('User email not found or unauthenticated');
        }

        // 4. Verify restaurant exists
        const { data: restaurant, error: restError } = await (supabase
            .from('restaurants' as any) as any)
            .select('id, stripe_customer_id')
            .eq('id', restaurantId)
            .single();

        if (restError || !restaurant) {
            throw new Error('Restaurant not found');
        }

        // 5. Build return URLs using NEXT_PUBLIC_APP_URL instead of client request headers
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const successUrl = `${appUrl}/admin/billing?success=true`;
        const cancelUrl = `${appUrl}/admin/billing?canceled=true`;

        const priceId = process.env.STRIPE_PRICE_ID;
        if (!priceId) {
            throw new Error('Stripe Price ID (STRIPE_PRICE_ID) is not configured');
        }

        // 6. Build Checkout session params
        const checkoutParams: any = {
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: successUrl,
            cancel_url: cancelUrl,
            client_reference_id: restaurantId,
            metadata: {
                restaurantId,
                userId: profile.id,
                source: 'orderpoint_checkout'
            },
        };

        // Reuse stripe_customer_id if already present on the database
        const dbRest = restaurant as any;
        if (dbRest.stripe_customer_id) {
            checkoutParams.customer = dbRest.stripe_customer_id;
        } else {
            checkoutParams.customer_email = user.email;
        }

        const session = await stripe.checkout.sessions.create(checkoutParams);

        if (!session.url) {
            throw new Error('No session URL returned from Stripe');
        }

        // Redirect to Stripe Checkout page
        redirect(session.url);
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
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error('CRITICAL CONFIGURATION ERROR: STRIPE_SECRET_KEY is not defined.');
        }

        // 1. Authorize role and check restaurant connection
        const profile = await requireRestaurantRole(['admin', 'owner']);
        if (!profile.restaurant_id) {
            throw new Error('Forbidden: No restaurant associated with this profile');
        }

        const supabase = await createClient();

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
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error('CRITICAL CONFIGURATION ERROR: STRIPE_SECRET_KEY is not defined.');
        }

        // 1. Enforce super admin authority
        await requireProfile(); // Ensures user profile is resolved first
        const supabase = await createClient();
        const userResponse = await supabase.auth.getUser();
        const userId = userResponse.data.user?.id;
        if (!userId) {
            throw new Error('Forbidden: Unauthenticated');
        }

        const { data: adminProfile } = await (supabase
            .from('profiles' as any) as any)
            .select('is_super_admin')
            .eq('id', userId)
            .single();

        if (!(adminProfile as any)?.is_super_admin) {
            throw new Error('Forbidden: Super Admin access required');
        }

        // 2. Validate UUID format
        if (!restaurantId || !restaurantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            throw new Error('Invalid restaurant ID format');
        }

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
