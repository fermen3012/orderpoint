'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireSuperAdmin, requireProfile, requireSameRestaurant, requireRestaurantRole } from '@/lib/auth/guards';
import { getDynamicStripe } from '@/lib/stripe';

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
    unit_price?: number;
}

/**
 * Super Admin: Retrieves billing information for all restaurants.
 */
export async function getAllCustomersBilling(): Promise<BillingCustomer[]> {
    try {
        await requireSuperAdmin();
        const supabase = await createClient();
        const stripe = await getDynamicStripe();

        // 1. Get all restaurants from Supabase
        let restaurantsResult: any[] = [];
        const { data: restaurants, error } = await (supabase
            .from('restaurants' as any) as any)
            .select('id, name, stripe_customer_id, stripe_subscription_id, plan_quantity, subscription_status, current_period_end, unit_price')
            .order('created_at', { ascending: false });

        if (error) {
            // Fallback in case current_period_end or unit_price column has not been added yet
            const { data: restaurantsFallback, error: fallbackError } = await (supabase
                .from('restaurants' as any) as any)
                .select('id, name, stripe_customer_id, stripe_subscription_id, plan_quantity, subscription_status')
                .order('created_at', { ascending: false });
            
            if (fallbackError) throw new Error(`Supabase Error: ${fallbackError.message}`);
            restaurantsResult = restaurantsFallback || [];
        } else {
            restaurantsResult = restaurants || [];
        }
        if (restaurantsResult.length === 0) return [];

        // Fetch owner profiles and auth users to get emails in bulk
        const { data: profiles } = await (supabase
            .from('profiles' as any) as any)
            .select('id, restaurant_id')
            .eq('role', 'owner');

        const { data: { users } } = await supabase.auth.admin.listUsers();

        // 2. Enrich with Stripe Data
        const enrichedCustomers = await Promise.all(
            restaurantsResult.map(async (rest: any) => {
                let mrr = 0;
                let next_billing_date = (rest as any).current_period_end || '';
                let currency = 'usd';
                let status = (rest as any).subscription_status || 'inactive';
                let quantity = (rest as any).plan_quantity || 1;
                let unit_price = (rest as any).unit_price || 49;

                const ownerProfile = profiles?.find((p: any) => p.restaurant_id === (rest as any).id);
                const authOwner = ownerProfile ? users.find(u => u.id === ownerProfile.id) : null;
                const email = authOwner?.email || '';

                if ((rest as any).stripe_subscription_id) {
                    try {
                        const sub = await stripe.subscriptions.retrieve((rest as any).stripe_subscription_id);
                        status = sub.status;

                        if (sub.items.data.length > 0) {
                            const mainItem = sub.items.data[0];
                            const price = mainItem.price.unit_amount || 0;
                            unit_price = price / 100;
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
                    email,
                    stripe_customer_id: (rest as any).stripe_customer_id,
                    stripe_subscription_id: (rest as any).stripe_subscription_id,
                    plan_quantity: quantity,
                    subscription_status: status,
                    mrr,
                    next_billing_date,
                    currency,
                    unit_price
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
        const stripe = await getDynamicStripe();

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
        const stripe = await getDynamicStripe();

        // 1. Get current subscription ID
        const { data: restaurant } = await (supabase
            .from('restaurants' as any) as any)
            .select('stripe_subscription_id, stripe_customer_id')
            .eq('id', restaurantId)
            .single();

        if (!restaurant?.stripe_subscription_id) {
            // No active subscription in Stripe: just update plan_quantity in the local database
            await (supabase
                .from('restaurants' as any) as any)
                .update({ plan_quantity: newQuantity })
                .eq('id', restaurantId);

            revalidatePath('/super-admin/billing');
            revalidatePath('/admin/billing');
            return { success: true };
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
        const stripe = await getDynamicStripe();
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
        const stripe = await getDynamicStripe();
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

export async function sendInvoiceEmail(restaurantId: string) {
    try {
        await requireSuperAdmin();

        // 1. Obtener restaurante e info del dueño
        const supabase = await createClient();
        const stripe = await getDynamicStripe();
        let rest: any = null;
        let { data: restData, error: restError } = await (supabase
            .from('restaurants' as any) as any)
            .select('name, stripe_customer_id, plan_quantity, unit_price')
            .eq('id', restaurantId)
            .single();

        if (restError) {
            // Fallback if unit_price is not yet in schema
            const { data: restFallback, error: fallbackError } = await (supabase
                .from('restaurants' as any) as any)
                .select('name, stripe_customer_id, plan_quantity')
                .eq('id', restaurantId)
                .single();
            if (fallbackError) throw new Error('Restaurante no encontrado');
            rest = restFallback;
        } else {
            rest = restData;
        }

        // Obtener perfil del dueño para sacar su correo
        const { data: profiles } = await (supabase
            .from('profiles' as any) as any)
            .select('id')
            .eq('restaurant_id', restaurantId)
            .eq('role', 'owner');

        let email = '';
        if (profiles && profiles.length > 0) {
            const { data: { users } } = await supabase.auth.admin.listUsers();
            const authOwner = users.find(u => u.id === profiles[0].id);
            email = authOwner?.email || '';
        }

        if (!email) {
            throw new Error('No se encontró un correo electrónico de propietario asignado para este restaurante.');
        }

        let customerId = (rest as any).stripe_customer_id;

        // 2. Si no existe cliente de Stripe, lo creamos
        if (!customerId) {
            const customer = await stripe.customers.create({
                email,
                name: (rest as any).name,
                metadata: {
                    restaurant_id: restaurantId
                }
            });
            customerId = customer.id;

            // Actualizar restaurante con el ID de cliente de Stripe
            await (supabase
                .from('restaurants' as any) as any)
                .update({ stripe_customer_id: customerId })
                .eq('id', restaurantId);
        }

        // 3. Crear el cobro (Invoice Item)
        const price = (rest as any).unit_price || 49;
        const unitAmount = Math.round(price * 100); // convert dollars to cents
        const quantity = (rest as any).plan_quantity || 1;

        await stripe.invoiceItems.create({
            customer: customerId,
            amount: unitAmount * quantity,
            currency: 'usd',
            description: `Mensualidad del servicio OrderPoint - ${quantity} Quiosco(s) / Licencia(s)`
        });

        // 4. Crear la Factura
        const invoice = await stripe.invoices.create({
            customer: customerId,
            collection_method: 'send_invoice',
            days_until_due: 7, // 7 días para pagar
            description: `Cobro mensual de suscripción a OrderPoint`
        });

        // 5. Finalizar la factura (esto hace que Stripe la envíe por correo automáticamente)
        await stripe.invoices.finalizeInvoice(invoice.id);

        return { success: true };
    } catch (err: any) {
        console.error('sendInvoiceEmail Error:', err);
        return { success: false, error: err.message || 'Error al enviar la factura por correo' };
    }
}

export async function updateSubscriptionPrice(restaurantId: string, newPriceAmount: number) {
    try {
        await requireSuperAdmin();

        if (newPriceAmount <= 0) {
            throw new Error('El costo debe ser mayor a 0');
        }

        const supabase = await createClient();
        const stripe = await getDynamicStripe();
        const { data: restaurant } = await (supabase
            .from('restaurants' as any) as any)
            .select('stripe_subscription_id')
            .eq('id', restaurantId)
            .single();

        const subscriptionId = restaurant?.stripe_subscription_id;
        if (!subscriptionId) {
            // No active subscription: update the local database unit_price
            const { error: updateError } = await (supabase
                .from('restaurants' as any) as any)
                .update({ unit_price: newPriceAmount })
                .eq('id', restaurantId);

            if (updateError) {
                throw new Error(`Error al actualizar el precio local: ${updateError.message}. ¿Ejecutó la migración SQL?`);
            }

            revalidatePath('/super-admin/billing');
            revalidatePath('/admin/billing');
            return { success: true };
        }

        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        if (sub.items.data.length === 0) {
            throw new Error('La suscripción no tiene ítems de facturación.');
        }

        const mainItem = sub.items.data[0];
        const productId = mainItem.price.product as string;
        const itemId = mainItem.id;
        const currentQuantity = mainItem.quantity || 1;

        const customPrice = await stripe.prices.create({
            unit_amount: Math.round(newPriceAmount * 100),
            currency: mainItem.price.currency,
            recurring: {
                interval: 'month',
            },
            product: productId,
        });

        await stripe.subscriptions.update(subscriptionId, {
            items: [{
                id: itemId,
                price: customPrice.id,
                quantity: currentQuantity
            }],
            proration_behavior: 'none',
        });

        revalidatePath('/super-admin/billing');
        return { success: true };
    } catch (err: any) {
        console.error('updateSubscriptionPrice Error:', err);
        return { success: false, error: err.message || 'Error al actualizar el costo de la suscripción' };
    }
}

export async function updateSubscriptionBillingDate(restaurantId: string, nextBillingDateIso: string) {
    try {
        await requireSuperAdmin();

        const timestamp = Math.floor(new Date(nextBillingDateIso).getTime() / 1000);
        if (isNaN(timestamp) || timestamp <= Math.floor(Date.now() / 1000)) {
            throw new Error('La fecha de vencimiento debe ser una fecha válida en el futuro.');
        }

        const supabase = await createClient();
        const stripe = await getDynamicStripe();
        const { data: restaurant } = await (supabase
            .from('restaurants' as any) as any)
            .select('stripe_subscription_id')
            .eq('id', restaurantId)
            .single();

        const subscriptionId = restaurant?.stripe_subscription_id;
        if (!subscriptionId) {
            // No active subscription: update current_period_end in the local database
            const { error: updateError } = await (supabase
                .from('restaurants' as any) as any)
                .update({ current_period_end: nextBillingDateIso })
                .eq('id', restaurantId);

            if (updateError) {
                throw new Error(`Error al actualizar la fecha local: ${updateError.message}. ¿Ejecutó la migración SQL?`);
            }

            revalidatePath('/super-admin/billing');
            revalidatePath('/admin/billing');
            return { success: true };
        }

        await stripe.subscriptions.update(subscriptionId, {
            trial_end: timestamp,
            proration_behavior: 'none',
        });

        revalidatePath('/super-admin/billing');
        return { success: true };
    } catch (err: any) {
        console.error('updateSubscriptionBillingDate Error:', err);
        return { success: false, error: err.message || 'Error al actualizar la fecha de facturación' };
    }
}

export async function updateCustomerEmail(restaurantId: string, newEmail: string) {
    try {
        await requireSuperAdmin();

        if (!newEmail || !newEmail.includes('@')) {
            throw new Error('Por favor, ingresa un correo electrónico válido.');
        }

        const supabase = await createClient();
        const stripe = await getDynamicStripe();
        const { data: restaurant } = await (supabase
            .from('restaurants' as any) as any)
            .select('stripe_customer_id')
            .eq('id', restaurantId)
            .single();

        const customerId = restaurant?.stripe_customer_id;
        
        // 1. Si ya tiene cliente en Stripe, actualizar su email en Stripe
        if (customerId) {
            await stripe.customers.update(customerId, { email: newEmail });
        }

        // 2. Localizar el perfil del dueño en profiles para actualizar Supabase Auth
        const { data: profiles } = await (supabase
            .from('profiles' as any) as any)
            .select('id')
            .eq('restaurant_id', restaurantId)
            .eq('role', 'owner');

        if (profiles && profiles.length > 0) {
            const ownerId = profiles[0].id;
            await supabase.auth.admin.updateUserById(ownerId, { email: newEmail });
        }

        revalidatePath('/super-admin/billing');
        return { success: true };
    } catch (err: any) {
        console.error('updateCustomerEmail Error:', err);
        return { success: false, error: err.message || 'Error al actualizar el correo electrónico del cliente' };
    }
}

export async function logClientError(message: string, stack?: string) {
    console.error('\n*** CLIENT ERROR DETECTED IN BILLING PAGE ***');
    console.error('Message:', message);
    if (stack) console.error('Stack:', stack);
    console.error('********************************************\n');
    return { success: true };
}
