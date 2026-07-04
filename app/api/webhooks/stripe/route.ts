import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase/server-admin';
import { stripe } from '@/lib/stripe';

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function GET() {
    return new NextResponse('Stripe Webhook Endpoint is active. Please use POST to send events.', { status: 200 });
}

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const body = await request.text();
    const sig = (await headers()).get('stripe-signature') as string;

    let event: Stripe.Event;

    try {
        if (!sig || !endpointSecret || !process.env.STRIPE_SECRET_KEY) {
            console.error('Webhook Error: Configuration variables are missing');
            return new NextResponse('Webhook Error: Configuration missing', { status: 400 });
        }
        event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err: any) {
        console.error(`Webhook Signature Verification Failed: ${err.message}`);
        return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
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
                let currentPeriodEnd = new Date();
                currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1); // Default backup date

                if (subscriptionId) {
                    try {
                        const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
                        status = subscription.status;
                        currentPeriodEnd = new Date(subscription.current_period_end * 1000);
                        if (subscription.items?.data?.length > 0) {
                            quantity = subscription.items.data[0].quantity || 1;
                        }
                    } catch (stripeError) {
                        console.error('Error fetching subscription details from Stripe:', stripeError);
                    }
                }

                // Update Supabase
                const { error } = await (supabaseAdmin
                    .from('restaurants' as any) as any)
                    .update({
                        subscription_status: status,
                        stripe_customer_id: customerId,
                        stripe_subscription_id: subscriptionId,
                        plan_quantity: quantity,
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

                if (subscription.items?.data?.length > 0) {
                    quantity = subscription.items.data[0].quantity || 1;
                }

                // Sync with DB
                const { error } = await (supabaseAdmin
                    .from('restaurants' as any) as any)
                    .update({
                        stripe_subscription_id: subscriptionId,
                        subscription_status: status,
                        plan_quantity: quantity,
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

                // Mark restaurant subscription status as canceled / inactive
                const { error } = await (supabaseAdmin
                    .from('restaurants' as any) as any)
                    .update({
                        subscription_status: 'canceled',
                        plan_quantity: 0
                    })
                    .eq('stripe_customer_id', customerId);

                if (error) {
                    console.error(`❌ Failed to deactivate subscription for customer ${customerId}:`, error);
                } else {
                    console.log(`🚫 Subscription deleted for customer ${customerId}. Restaurant marked as canceled.`);
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
        return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
    }

    return new NextResponse(JSON.stringify({ received: true }), { status: 200 });
}
