import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase/server-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    typescript: true,
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Add GET method to avoid 405 error when testing in browser
export async function GET() {
    return new NextResponse('Stripe Webhook Endpoint is active. Please use POST to send events.', { status: 200 });
}

export async function POST(request: Request) {
    const body = await request.text();
    const sig = (await headers()).get('stripe-signature') as string;

    let event: Stripe.Event;

    try {
        if (!sig || !endpointSecret) {
            console.error('Webhook Error: Missing signature or endpoint secret');
            return new NextResponse('Webhook Error', { status: 400 });
        }
        event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err: any) {
        console.error(`Webhook Signature Verification Failed: ${err.message}`);
        return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // Handle the event
    try {
        switch (event.type) {
            // Event sent when a checkout session is successfully completed (payment made)
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;

                // This is the critical part: client_reference_id must be the restaurantId sent from frontend
                const restaurantId = session.client_reference_id;
                const customerId = session.customer as string;

                if (!restaurantId) {
                    console.warn('⚠️ No client_reference_id found in session. Cannot link to restaurant.');
                    break;
                }

                console.log(`✅ Payment received for Restaurant ID: ${restaurantId}`);

                // Calculate period end if available, otherwise default to a month from now (logic can vary)
                // Usually, for subscriptions, we might listen to 'invoice.payment_succeeded' for recurring updates,
                // but 'checkout.session.completed' is great for the initial activation.

                // If it's a subscription, let's fetch it to get precise dates
                let currentPeriodEnd = new Date();
                currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1); // Default backup

                if (session.subscription) {
                    const subscription: any = await stripe.subscriptions.retrieve(session.subscription as string);
                    currentPeriodEnd = new Date(subscription.current_period_end * 1000);
                }

                // Update Supabase
                const { error } = await supabaseAdmin
                    .from('restaurants')
                    .update({
                        subscription_status: 'active',
                        stripe_customer_id: customerId,
                        current_period_end: currentPeriodEnd.toISOString()
                    })
                    .eq('id', restaurantId);

                if (error) {
                    console.error('❌ Failed to update restaurant in Supabase:', error);
                    return new NextResponse('Database Error', { status: 500 });
                }

                console.log(`🎉 Restaurant ${restaurantId} activated successfully.`);
                break;
            }

            // Event sent when a subscription is canceled or unpaid
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;

                // Find restaurant by stripe_customer_id
                const { error } = await supabaseAdmin
                    .from('restaurants')
                    .update({ subscription_status: 'inactive' })
                    .eq('stripe_customer_id', customerId);

                if (error) {
                    console.error('❌ Failed to deactivate restaurant:', error);
                } else {
                    console.log(`🚫 Subscription deleted for customer ${customerId}. Restaurant deactivated.`);
                }
                break;
            }

            // Optional: Handle successful recurring payments to update the period end
            case 'invoice.payment_succeeded': {
                const invoice = event.data.object as Stripe.Invoice;
                if (invoice.subscription) {
                    const subscriptionId = invoice.subscription as string;
                    const subscription: any = await stripe.subscriptions.retrieve(subscriptionId);
                    const customerId = subscription.customer as string;

                    await supabaseAdmin
                        .from('restaurants')
                        .update({
                            subscription_status: 'active', // Ensure it stays active
                            current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
                        })
                        .eq('stripe_customer_id', customerId);

                    console.log(`🔄 Recurring payment success for customer ${customerId}. Period extended.`);
                }
                break;
            }

            // Optional: Handle payment failure
            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                const customerId = invoice.customer as string;
                await supabaseAdmin
                    .from('restaurants')
                    .update({ subscription_status: 'past_due' })
                    .eq('stripe_customer_id', customerId);
                console.log(`⚠️ Payment failed for customer ${customerId}. Status set to past_due.`);
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
