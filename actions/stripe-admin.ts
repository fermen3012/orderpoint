'use server';

import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireSuperAdmin, requireProfile, requireSameRestaurant, requireRestaurantRole } from '@/lib/auth/guards';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-01-28.clover' as any, // Stable version supported by the local SDK
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

/**
 * Super Admin: Retrieves billing information for all restaurants.
 */
export async function getAllCustomersBilling(): Promise<BillingCustomer[]> {
    try {
        await requireSuperAdmin();
        const supabase = await createClient();

        // 1. Get all restaurants from Supabase
        const { data: restaurants, error } = await (supabase
            .from('restaurants' as any) as any)
            .select('id, name, stripe_customer_id, stripe_subscription_id, plan_quantity, subscription_status')
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Supabase Error: ${error.message}`);
        if (!restaurants) return [];

        // 2. Enrich with Stripe Data
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

                        if (sub.items.data.length > 0) {
                            const mainItem = sub.items.data[0];
                            const price = mainItem.price.unit_amount || 0;
                            quantity = mainItem.quantity || 1;
                            mrr = (price * quantity) / 100;
                            currency = mainItem.price.currency;
                        }

                        next_billing_date = new Date((sub as any).current_period_end * 1000).toISOString();
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
        throw new Error('No se pudo obtener la facturación global de clientes');
    }
}

/**
 * Restaurant Owner: Retrieves billing information for their specific restaurant.
 */
export async function getOwnerBilling(restaurantId: string): Promise<BillingCustomer | null> {
    try {
        await requireRestaurantRole(['admin', 'owner']);
        await requireSameRestaurant(restaurantId);

        // Validate UUID
        if (!restaurantId || !restaurantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            throw new Error('Invalid restaurant ID format');
        }

        const supabase = await createClient();

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

        // If active subscription exists, fetch the latest details from Stripe
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

/**
 * Super Admin: Updates the subscription quantity/license count.
 */
export async function updateSubscriptionQuantity(restaurantId: string, newQuantity: number) {
    try {
        await requireSuperAdmin();

        // Validate quantity
        if (!Number.isInteger(newQuantity) || newQuantity < 1) {
            throw new Error('La cantidad de licencias debe ser un número entero mayor o igual a 1');
        }

        // Validate UUID
        if (!restaurantId || !restaurantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            throw new Error('Invalid restaurant ID format');
        }

        const supabase = await createClient();

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

        revalidatePath('/super-admin/billing');
        revalidatePath('/admin/billing');
        return { success: true };

    } catch (err: any) {
        console.error('updateSubscriptionQuantity Error:', err);
        return { success: false, error: err.message || 'Error al actualizar la suscripción' };
    }
}

/**
 * Retrieves paid invoices.
 * For Owners, restaurantId parameter is ignored and resolved from profile.
 * For Super Admins, resolves Stripe Customer ID from the provided restaurantId.
 */
export async function getCustomerInvoices(restaurantId?: string) {
    try {
        const profile = await requireProfile();
        let targetRestaurantId = restaurantId;

        if (!profile.is_super_admin) {
            // Owner flow
            if (profile.role !== 'admin' && profile.role !== 'owner') {
                throw new Error('Forbidden: Unauthorized role');
            }
            if (!profile.restaurant_id) {
                throw new Error('Forbidden: No restaurant associated');
            }
            targetRestaurantId = profile.restaurant_id;
        } else {
            // Super Admin flow: requires explicit restaurantId
            if (!targetRestaurantId) {
                throw new Error('Restaurant ID is required for Super Admin queries');
            }
        }

        // Validate UUID
        if (!targetRestaurantId || !targetRestaurantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            throw new Error('Invalid restaurant ID format');
        }

        const supabase = await createClient();
        const { data: rest, error: restError } = await (supabase
            .from('restaurants' as any) as any)
            .select('stripe_customer_id')
            .eq('id', targetRestaurantId)
            .single();

        if (restError || !rest || !(rest as any).stripe_customer_id) {
            return []; // Return empty invoices list if no Stripe Customer exists
        }

        const invoices = await stripe.invoices.list({
            customer: (rest as any).stripe_customer_id,
            limit: 12,
            status: 'paid',
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

/**
 * Generates Stripe Portal link.
 * For Owners, restaurantId parameter is ignored and resolved from profile.
 * For Super Admins, resolves Stripe Customer ID from the provided restaurantId.
 */
export async function generatePortalLink(restaurantId?: string) {
    try {
        const profile = await requireProfile();
        let targetRestaurantId = restaurantId;

        if (!profile.is_super_admin) {
            // Owner flow
            if (profile.role !== 'admin' && profile.role !== 'owner') {
                throw new Error('Forbidden: Unauthorized role');
            }
            if (!profile.restaurant_id) {
                throw new Error('Forbidden: No restaurant associated');
            }
            targetRestaurantId = profile.restaurant_id;
        } else {
            // Super admin flow
            if (!targetRestaurantId) {
                throw new Error('Restaurant ID is required for Super Admin queries');
            }
        }

        // Validate UUID
        if (!targetRestaurantId || !targetRestaurantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            throw new Error('Invalid restaurant ID format');
        }

        const supabase = await createClient();
        const { data: rest, error: restError } = await (supabase
            .from('restaurants' as any) as any)
            .select('stripe_customer_id')
            .eq('id', targetRestaurantId)
            .single();

        if (restError || !rest || !(rest as any).stripe_customer_id) {
            throw new Error('No Stripe Customer ID associated with this restaurant');
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const returnUrl = profile.is_super_admin ? `${appUrl}/super-admin/billing` : `${appUrl}/admin/billing`;

        const session = await stripe.billingPortal.sessions.create({
            customer: (rest as any).stripe_customer_id,
            return_url: returnUrl,
        });

        return session.url;
    } catch (err: any) {
        console.error('generatePortalLink Error:', err);
        return null;
    }
}
