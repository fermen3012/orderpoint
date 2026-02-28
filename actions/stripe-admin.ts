'use server';

import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-01-28.clover', // Use latest stable version supported by the SDK
});

export interface BillingCustomer {
    id: string; // Restaurant ID
    name: string;
    email?: string;
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    plan_quantity: number;
    subscription_status: string;
    mrr: number;
    next_billing_date?: string;
    currency?: string;
}

export async function getAllCustomersBilling(): Promise<BillingCustomer[]> {
    const supabase = await createClient();

    try {
        // 1. Get all restaurants from Supabase
        const { data: restaurants, error } = await (supabase
            .from('restaurants' as any) as any)
            .select('id, name, stripe_customer_id, stripe_subscription_id, plan_quantity, subscription_status')
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Supabase Error: ${error.message}`);
        if (!restaurants) return [];

        // 2. Enrich with Stripe Data (in parallel for performance)
        const enrichedCustomers = await Promise.all(
            restaurants.map(async (rest: any) => {
                let mrr = 0;
                let next_billing_date = '';
                let currency = 'usd';
                let status = (rest as any).subscription_status || 'inactive';
                let quantity = (rest as any).plan_quantity || 1;

                if ((rest as any).stripe_subscription_id) {
                    try {
                        const sub = await stripe.subscriptions.retrieve((rest as any).stripe_subscription_id);
                        status = sub.status;

                        // Calculate MRR from active items
                        if (sub.items.data.length > 0) {
                            const mainItem = sub.items.data[0];
                            const price = mainItem.price.unit_amount || 0;
                            quantity = mainItem.quantity || 1;
                            mrr = (price * quantity) / 100;
                            currency = mainItem.price.currency;
                        }

                        next_billing_date = new Date((sub as any).current_period_end * 1000).toISOString();

                        // Sync DB if needed (optional optimization)
                    } catch (stripeError) {
                        console.error(`Stripe Error for ${(rest as any).id}:`, stripeError);
                        status = 'error_sync';
                    }
                }

                return {
                    id: (rest as any).id,
                    name: (rest as any).name,
                    stripe_customer_id: (rest as any).stripe_customer_id,
                    stripe_subscription_id: (rest as any).stripe_subscription_id,
                    plan_quantity: quantity,
                    subscription_status: status,
                    mrr,
                    next_billing_date,
                    currency
                };
            })
        );

        return enrichedCustomers;

    } catch (err: any) {
        console.error('getAllCustomersBilling Error:', err);
        throw new Error(err.message);
    }
}

export async function getOwnerBilling(restaurantId: string): Promise<BillingCustomer | null> {
    const supabase = await createClient();

    try {
        const { data: restaurant, error } = await (supabase
            .from('restaurants' as any) as any)
            .select('id, name, stripe_customer_id, stripe_subscription_id, plan_quantity, subscription_status')
            .eq('id', restaurantId)
            .single();

        if (error || !restaurant) return null;

        let mrr = 0;
        let next_billing_date = '';
        let currency = 'usd';
        let status = restaurant.subscription_status || 'inactive';
        let quantity = restaurant.plan_quantity || 1;

        if (restaurant.stripe_subscription_id) {
            try {
                const sub = await stripe.subscriptions.retrieve(restaurant.stripe_subscription_id);
                status = sub.status;

                if (sub.items.data.length > 0) {
                    const mainItem = sub.items.data[0];
                    const price = mainItem.price.unit_amount || 0;
                    quantity = mainItem.quantity || 1;
                    mrr = (price * quantity) / 100;
                    currency = mainItem.price.currency;
                }

                next_billing_date = new Date((sub as any).current_period_end * 1000).toISOString();
            } catch (stripeError) {
                console.error(`Stripe Error for ${restaurant.id}:`, stripeError);
                status = 'error_sync';
            }
        }

        return {
            id: restaurant.id,
            name: restaurant.name,
            stripe_customer_id: restaurant.stripe_customer_id,
            stripe_subscription_id: restaurant.stripe_subscription_id,
            plan_quantity: quantity,
            subscription_status: status,
            mrr,
            next_billing_date,
            currency
        };

    } catch (err: any) {
        console.error('getOwnerBilling Error:', err);
        return null;
    }
}

export async function updateSubscriptionQuantity(restaurantId: string, newQuantity: number) {
    const supabase = await createClient();

    try {
        // 1. Get current subscription ID
        const { data: restaurant } = await (supabase
            .from('restaurants' as any) as any)
            .select('stripe_subscription_id, stripe_customer_id')
            .eq('id', restaurantId)
            .single();

        if (!restaurant?.stripe_subscription_id) {
            throw new Error('No active subscription found for this restaurant.');
        }

        // 2. Get Subscription from Stripe to find the ITEM ID
        const sub = await stripe.subscriptions.retrieve((restaurant as any).stripe_subscription_id);
        const itemId = sub.items.data[0].id; // Assuming single plan item

        // 3. Update Stripe
        await stripe.subscriptions.update((restaurant as any).stripe_subscription_id, {
            items: [{ id: itemId, quantity: newQuantity }],
            proration_behavior: 'always_invoice', // Invoice immediately for prorations
        });

        // 4. Update Database
        await (supabase
            .from('restaurants' as any) as any)
            .update({ plan_quantity: newQuantity })
            .eq('id', restaurantId);

        revalidatePath('/admin/billing');
        return { success: true };

    } catch (err: any) {
        console.error('updateSubscriptionQuantity Error:', err);
        return { success: false, error: err.message };
    }
}

export async function getCustomerInvoices(stripeCustomerId: string) {
    if (!stripeCustomerId) return [];
    try {
        const invoices = await stripe.invoices.list({
            customer: stripeCustomerId,
            limit: 12,
            status: 'paid', // Or 'all'
        });

        return invoices.data.map(inv => ({
            id: inv.id,
            date: new Date(inv.created * 1000).toLocaleDateString(),
            amount: (inv.total / 100).toFixed(2),
            currency: inv.currency.toUpperCase(),
            status: inv.status,
            pdf_url: inv.hosted_invoice_url,
            number: inv.number
        }));
    } catch (err) {
        console.error('getCustomerInvoices Error:', err);
        return [];
    }
}

export async function generatePortalLink(stripeCustomerId: string) {
    if (!stripeCustomerId) return null;
    try {
        const session = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: `${process.env.NEXT_PUBLIC_APP_URL}/admin/billing`,
        });
        return session.url;
    } catch (err) {
        console.error('generatePortalLink Error:', err);
        return null;
    }
}
