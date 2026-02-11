'use server';

import { stripe } from '@/lib/stripe';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export async function createCheckoutSession(restaurantId: string, email: string) {
    try {
        const origin = (await headers()).get('origin');

        // This is a placeholder price ID. In production you must set STRIPE_PRICE_ID
        const priceId = process.env.STRIPE_PRICE_ID;

        if (!priceId) {
            throw new Error('Stripe Price ID is not configured');
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${origin}/admin/billing?success=true`,
            cancel_url: `${origin}/admin/billing?canceled=true`,
            customer_email: email,
            client_reference_id: restaurantId,
            metadata: {
                restaurantId,
            },
        });

        if (!session.url) {
            throw new Error('No session URL returned');
        }

        redirect(session.url);
    } catch (error) {
        console.error('Error creating checkout session:', error);
        throw error;
    }
}

export async function createCustomerPortalSession(stripeCustomerId: string) {
    try {
        const origin = (await headers()).get('origin');

        const session = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: `${origin}/admin/billing`,
        });

        if (!session.url) {
            throw new Error('No session URL returned');
        }

        redirect(session.url);
    } catch (error) {
        console.error('Error creating portal session:', error);
        throw error;
    }
}
