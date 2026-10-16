import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase/server-admin';
import { getDynamicStripe, getDynamicWebhookSecret } from '@/lib/stripe';

// Idempotency cache to prevent replay/duplicate webhook execution within the server instance
const processedWebhookEvents = new Set<string>();
const WEBHOOK_TOLERANCE_SECONDS = 300; // Strict 5-minute replay window

export async function GET() {
    return new NextResponse('Stripe Webhook Endpoint is active. Please use POST to send events.', { status: 200 });
}

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    // 1. Read payload strictly as raw binary Buffer without prior JSON parsing
    const rawArrayBuffer = await request.arrayBuffer();
    const rawBody = Buffer.from(rawArrayBuffer);
    const sig = (await headers()).get('stripe-signature') as string;

    let event: Stripe.Event;
    let stripe: Stripe;

    try {
        stripe = await getDynamicStripe();
        const endpointSecret = await getDynamicWebhookSecret();

        if (!sig || !endpointSecret || rawBody.length === 0) {
            console.error('Webhook Error: Missing signature, secret, or empty payload');
            return new NextResponse('Webhook Error: Invalid request signature or configuration', { status: 400 });
        }

        // 2. Cryptographic signature verification with strict 300s timestamp tolerance against replay attacks
        event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret, WEBHOOK_TOLERANCE_SECONDS);

        const nowSeconds = Math.floor(Date.now() / 1000);
        if (Math.abs(nowSeconds - event.created) > WEBHOOK_TOLERANCE_SECONDS) {
            console.error(`Webhook Replay Blocked: Event ${event.id} timestamp drift exceeded ${WEBHOOK_TOLERANCE_SECONDS}s`);
            return new NextResponse('Webhook Error: Event timestamp outside tolerance window', { status: 400 });
        }
    } catch (err: any) {
        console.error(`Webhook Signature Verification Failed: ${err.message}`);
        return new NextResponse('Webhook Error: Signature verification failed', { status: 400 });
    }

    // 3. Fast in-memory idempotency check
    if (processedWebhookEvents.has(event.id)) {
        return new NextResponse(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
    }

    // 4. Persistent atomic DB-level idempotency check (prevents duplicate execution across serverless instances)
    const idempotencyKey = `stripe_evt_${event.id}`;
    try {
        const { error: lockError } = await (supabaseAdmin
            .from('system_settings' as any) as any)
            .insert({
                key: idempotencyKey,
                value: JSON.stringify({
                    event_id: event.id,
                    type: event.type,
                    processed_at: new Date().toISOString(),
                }),
                description: `Webhook Idempotency Lock: ${event.type}`,
                updated_at: new Date().toISOString(),
            });

        if (lockError) {
            // PostgreSQL 23505 = unique_violation (event.id already recorded by a previous or concurrent transaction)
            if (lockError.code === '23505' || String(lockError.message).toLowerCase().includes('duplicate')) {
                processedWebhookEvents.add(event.id);
                return new NextResponse(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
            }
        }
    } catch (lockErr) {
        console.warn('Webhook DB idempotency warning:', lockErr);
    }

    processedWebhookEvents.add(event.id);
    if (processedWebhookEvents.size > 1000) {
        const firstId = processedWebhookEvents.values().next().value;
        if (firstId) processedWebhookEvents.delete(firstId);
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const restaurantId = session.client_reference_id;
                const customerId = session.customer as string;
                const subscriptionId = session.subscription as string;

                if (!restaurantId) {
                    console.warn('⚠️ No client_reference_id found in checkout session.');
                    break;
                }

                if (!subscriptionId) {
                    console.error('❌ No subscription ID found in checkout session.');
                    return new NextResponse('Webhook Error: Subscription ID is required', { status: 400 });
                }

                console.log(`✅ Checkout completed for Restaurant ID: ${restaurantId}`);

                let status = 'active';
                let quantity = 1;
                let unitPrice: number | undefined = undefined;
                let currentPeriodEnd = new Date();
                currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1); // Default backup date

                if (subscriptionId) {
                    try {
                        const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
                        status = subscription.status;
                        currentPeriodEnd = new Date(subscription.current_period_end * 1000);
                        if (subscription.items?.data?.length > 0) {
                            const mainItem = subscription.items.data[0];
                            quantity = mainItem.quantity || 1;
                            if (typeof mainItem.price?.unit_amount === 'number') {
                                unitPrice = mainItem.price.unit_amount / 100;
                            }
                        }
                    } catch (stripeError) {
                        console.error('Error fetching subscription details from Stripe:', stripeError);
                    }
                }

                // Update Supabase and reactivate restaurant
                const { error } = await (supabaseAdmin
                    .from('restaurants' as any) as any)
                    .update({
                        is_active: true,
                        subscription_status: status,
                        stripe_customer_id: customerId,
                        stripe_subscription_id: subscriptionId,
                        plan_quantity: quantity,
                        ...(unitPrice !== undefined ? { unit_price: unitPrice } : {}),
                        current_period_end: currentPeriodEnd.toISOString()
                    })
                    .eq('id', restaurantId);

                if (error) {
                    console.error('❌ Failed to update restaurant subscription in database:', error);
                    return new NextResponse('Database Error', { status: 500 });
                }

                console.log(`🎉 Restaurant ${restaurantId} subscription initialized successfully.`);
                break;
            }

            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const subscription = event.data.object as any;
                const customerId = subscription.customer as string;
                const subscriptionId = subscription.id;
                const status = subscription.status;
                const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
                let quantity = 1;
                let unitPrice: number | undefined = undefined;

                if (subscription.items?.data?.length > 0) {
                    const mainItem = subscription.items.data[0];
                    quantity = mainItem.quantity || 1;
                    if (typeof mainItem.price?.unit_amount === 'number') {
                        unitPrice = mainItem.price.unit_amount / 100;
                    }
                }

                // Sync with DB
                const { error } = await (supabaseAdmin
                    .from('restaurants' as any) as any)
                    .update({
                        stripe_subscription_id: subscriptionId,
                        subscription_status: status,
                        plan_quantity: quantity,
                        ...(unitPrice !== undefined ? { unit_price: unitPrice } : {}),
                        current_period_end: currentPeriodEnd.toISOString()
                    })
                    .eq('stripe_customer_id', customerId);

                if (error) {
                    console.error(`❌ Failed to update subscription status for customer ${customerId}:`, error);
                } else {
                    console.log(`🔄 Subscription updated for customer ${customerId}. Status: ${status}.`);
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as any;
                const customerId = subscription.customer as string;

                // Mark restaurant subscription status as canceled and activate Kill-Switch (is_active: false)
                const { error } = await (supabaseAdmin
                    .from('restaurants' as any) as any)
                    .update({
                        is_active: false,
                        subscription_status: 'canceled',
                        plan_quantity: 0
                    })
                    .eq('stripe_customer_id', customerId);

                if (error) {
                    console.error(`❌ Failed to deactivate subscription for customer ${customerId}:`, error);
                } else {
                    console.log(`🚫 Subscription deleted for customer ${customerId}. Restaurant suspended (is_active: false).`);
                }
                break;
            }

            case 'invoice.payment_succeeded': {
                const invoice = event.data.object as any;
                const customerId = invoice.customer as string;
                const subscriptionId = invoice.subscription as string;

                let currentPeriodEnd = new Date();
                currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

                if (subscriptionId) {
                    try {
                        const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
                        currentPeriodEnd = new Date(subscription.current_period_end * 1000);
                    } catch (stripeError) {
                        console.error('Error fetching updated period end from Stripe:', stripeError);
                    }
                }

                const { error } = await (supabaseAdmin
                    .from('restaurants' as any) as any)
                    .update({
                        is_active: true,
                        subscription_status: 'active',
                        current_period_end: currentPeriodEnd.toISOString()
                    })
                    .eq('stripe_customer_id', customerId);

                if (error) {
                    console.error(`❌ Failed to extend subscription period end for customer ${customerId}:`, error);
                } else {
                    console.log(`🔄 Recurring payment succeeded for customer ${customerId}. Period extended.`);
                }
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                const customerId = invoice.customer as string;

                const { error } = await (supabaseAdmin
                    .from('restaurants' as any) as any)
                    .update({
                        subscription_status: 'past_due'
                    })
                    .eq('stripe_customer_id', customerId);

                if (error) {
                    console.error(`❌ Failed to set past_due status for customer ${customerId}:`, error);
                } else {
                    console.log(`⚠️ Recurring payment failed for customer ${customerId}. Status set to past_due.`);
                }
                break;
            }

            default:
                console.log(`Unhandled event type ${event.type}`);
        }
    } catch (error: any) {
        console.error('Error processing webhook event:', error);
        processedWebhookEvents.delete(event.id);
        try {
            await (supabaseAdmin.from('system_settings' as any) as any)
                .delete()
                .eq('key', idempotencyKey);
        } catch {}
        return new NextResponse('Internal Server Error', { status: 500 });
    }

    return new NextResponse(JSON.stringify({ received: true }), { status: 200 });
}
