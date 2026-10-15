'use server';

import { getAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { getDynamicStripe } from '@/lib/stripe';
import { SubscriptionPlan, DEFAULT_SUBSCRIPTION_PLANS } from '@/lib/subscription-plans';

export type { SubscriptionPlan };

const SETTINGS_KEY = 'subscription_plans_config';

/**
 * Super Admin: Obtiene todos los planes de suscripción configurados.
 */
export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    try {
        const supabase = getAdminClient();

        const { data, error } = await (supabase
            .from('system_settings' as any) as any)
            .select('value')
            .eq('key', SETTINGS_KEY)
            .single();

        if (error || !data?.value) {
            // Guardar planes por defecto iniciales si no existen
            await saveInitialDefaultPlans();
            return DEFAULT_SUBSCRIPTION_PLANS;
        }

        try {
            const parsed = JSON.parse(data.value);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
            return DEFAULT_SUBSCRIPTION_PLANS;
        } catch {
            return DEFAULT_SUBSCRIPTION_PLANS;
        }
    } catch (err: any) {
        console.error('Error fetching subscription plans:', err);
        return DEFAULT_SUBSCRIPTION_PLANS;
    }
}

/**
 * Super Admin: Inicializa los planes por defecto en la base de datos si la clave no existe.
 */
async function saveInitialDefaultPlans() {
    try {
        const supabase = getAdminClient();
        await (supabase
            .from('system_settings' as any) as any)
            .upsert({
                key: SETTINGS_KEY,
                value: JSON.stringify(DEFAULT_SUBSCRIPTION_PLANS),
                description: 'Planes de suscripción y precios comerciales de OrderPoint SaaS',
                updated_at: new Date().toISOString(),
            }, { onConflict: 'key' });
    } catch (err) {
        console.error('Error saving initial default plans:', err);
    }
}

/**
 * Super Admin: Guarda o actualiza un plan de suscripción, opcionalmente sincronizándolo con Stripe.
 */
export async function saveSubscriptionPlan(plan: SubscriptionPlan, syncStripe: boolean = false) {
    try {
        await requireSuperAdmin();
        const supabase = getAdminClient();

        // 1. Opcional: Sincronizar o crear en Stripe si se solicitó
        let stripeProductId = plan.stripe_product_id;
        let stripePriceId = plan.stripe_price_id;

        if (syncStripe) {
            try {
                const stripe = await getDynamicStripe();

                // Crear o actualizar Producto en Stripe
                if (!stripeProductId) {
                    const product = await stripe.products.create({
                        name: `OrderPoint - ${plan.name}`,
                        description: plan.description.slice(0, 500),
                        metadata: {
                            plan_id: plan.id,
                            category: plan.category,
                            setup_fee: String(plan.setup_fee),
                        }
                    });
                    stripeProductId = product.id;
                } else {
                    await stripe.products.update(stripeProductId, {
                        name: `OrderPoint - ${plan.name}`,
                        description: plan.description.slice(0, 500),
                    });
                }

                // Crear Precio recurrente en Stripe si no existe o cambió
                const price = await stripe.prices.create({
                    unit_amount: Math.round(plan.monthly_price * 100),
                    currency: 'usd',
                    recurring: {
                        interval: 'month',
                    },
                    product: stripeProductId,
                    metadata: {
                        plan_id: plan.id,
                    }
                });
                stripePriceId = price.id;
            } catch (stripeErr: any) {
                console.warn('Stripe sync warning (se guardará en base de datos local):', stripeErr?.message);
            }
        }

        // 2. Obtener lista actual de planes
        const currentPlans = await getSubscriptionPlans();
        const now = new Date().toISOString();

        const updatedPlan: SubscriptionPlan = {
            ...plan,
            stripe_product_id: stripeProductId,
            stripe_price_id: stripePriceId,
            updated_at: now,
            created_at: plan.created_at || now,
        };

        const existingIndex = currentPlans.findIndex(p => p.id === plan.id);
        let newPlansList: SubscriptionPlan[];

        if (existingIndex >= 0) {
            newPlansList = [...currentPlans];
            newPlansList[existingIndex] = updatedPlan;
        } else {
            newPlansList = [updatedPlan, ...currentPlans];
        }

        // 3. Persistir en system_settings
        const { error } = await (supabase
            .from('system_settings' as any) as any)
            .upsert({
                key: SETTINGS_KEY,
                value: JSON.stringify(newPlansList),
                description: 'Planes de suscripción y precios comerciales de OrderPoint SaaS',
                updated_at: now,
            }, { onConflict: 'key' });

        if (error) {
            throw new Error(`Error en Supabase: ${error.message}`);
        }

        revalidatePath('/super-admin/billing');
        revalidatePath('/admin/billing');
        return { success: true, plan: updatedPlan };
    } catch (err: any) {
        console.error('Error in saveSubscriptionPlan:', err);
        return { success: false, error: err.message || 'Error al guardar el plan' };
    }
}

/**
 * Super Admin: Elimina o desactiva un plan de pago.
 */
export async function deleteSubscriptionPlan(planId: string) {
    try {
        await requireSuperAdmin();
        const supabase = getAdminClient();

        const currentPlans = await getSubscriptionPlans();
        const filtered = currentPlans.filter(p => p.id !== planId);

        const { error } = await (supabase
            .from('system_settings' as any) as any)
            .upsert({
                key: SETTINGS_KEY,
                value: JSON.stringify(filtered),
                description: 'Planes de suscripción y precios comerciales de OrderPoint SaaS',
                updated_at: new Date().toISOString(),
            }, { onConflict: 'key' });

        if (error) throw new Error(error.message);

        revalidatePath('/super-admin/billing');
        revalidatePath('/admin/billing');
        return { success: true };
    } catch (err: any) {
        console.error('Error in deleteSubscriptionPlan:', err);
        return { success: false, error: err.message || 'Error al eliminar el plan' };
    }
}

/**
 * Super Admin: Asigna un plan de suscripción directamente a un restaurante cliente.
 */
export async function assignPlanToRestaurant(restaurantId: string, planId: string) {
    try {
        await requireSuperAdmin();
        const supabase = getAdminClient();

        const plans = await getSubscriptionPlans();
        const selectedPlan = plans.find(p => p.id === planId);
        if (!selectedPlan) {
            throw new Error('El plan seleccionado no existe');
        }

        // 1. Guardar mapeo en system_settings y actualizar restaurante
        await saveRestaurantPlanMapping(restaurantId, planId);

        const { error: restError } = await (supabase
            .from('restaurants' as any) as any)
            .update({
                unit_price: selectedPlan.monthly_price,
                subscription_status: 'active',
            })
            .eq('id', restaurantId);

        if (restError) {
            throw new Error(`Error al actualizar restaurante: ${restError.message}`);
        }

        // Intento silencioso de actualizar columna plan_id si existe en PostgreSQL
        try {
            await (supabase.from('restaurants' as any) as any)
                .update({ plan_id: planId })
                .eq('id', restaurantId);
        } catch {
            // Ignorar si la columna no existe aún
        }

        // 2. Si tiene suscripción en Stripe y el plan tiene un stripe_price_id, actualizar en Stripe
        const { data: rest } = await (supabase
            .from('restaurants' as any) as any)
            .select('stripe_subscription_id')
            .eq('id', restaurantId)
            .single();

        if (rest?.stripe_subscription_id && selectedPlan.stripe_price_id) {
            try {
                const stripe = await getDynamicStripe();
                const sub = await stripe.subscriptions.retrieve(rest.stripe_subscription_id);
                if (sub.items.data.length > 0) {
                    const itemId = sub.items.data[0].id;
                    await stripe.subscriptions.update(rest.stripe_subscription_id, {
                        items: [{
                            id: itemId,
                            price: selectedPlan.stripe_price_id,
                        }],
                        proration_behavior: 'none',
                    });
                }
            } catch (stripeErr: any) {
                console.warn('Advertencia actualizando Stripe Subscription:', stripeErr?.message);
            }
        }

        revalidatePath('/super-admin/billing');
        revalidatePath('/admin/billing');
        revalidatePath('/[locale]/super-admin/restaurants', 'page');
        return { success: true, planName: selectedPlan.name };
    } catch (err: any) {
        console.error('Error in assignPlanToRestaurant:', err);
        return { success: false, error: err.message || 'Error al asignar el plan' };
    }
}

/**
 * Obtiene el mapa de planes asignados a cada restaurante desde system_settings.
 */
export async function getRestaurantPlansMap(): Promise<Record<string, string>> {
    try {
        const supabase = getAdminClient();
        const { data, error } = await (supabase
            .from('system_settings' as any) as any)
            .select('value')
            .eq('key', 'restaurant_plans_map')
            .single();

        if (error || !data?.value) {
            return {};
        }

        return JSON.parse(data.value);
    } catch {
        return {};
    }
}

/**
 * Guarda o actualiza el plan asignado a un restaurante en system_settings.
 */
export async function saveRestaurantPlanMapping(restaurantId: string, planId: string): Promise<void> {
    try {
        const supabase = getAdminClient();
        const currentMap = await getRestaurantPlansMap();
        currentMap[restaurantId] = planId;

        await (supabase
            .from('system_settings' as any) as any)
            .upsert({
                key: 'restaurant_plans_map',
                value: JSON.stringify(currentMap),
                description: 'Mapeo de planes SaaS asignados a cada restaurante',
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
    } catch (e) {
        console.warn('Could not save restaurant plan mapping:', e);
    }
}

/**
 * Super Admin: Actualiza el plan y/o precio personalizado de un restaurante existente.
 */
export async function updateRestaurantPlan(
    restaurantId: string,
    planId: string,
    customPrice?: number
): Promise<{ success: boolean; planName?: string; error?: string }> {
    try {
        await requireSuperAdmin();
        const supabase = getAdminClient();

        const plans = await getSubscriptionPlans();
        const selectedPlan = plans.find(p => p.id === planId);
        if (!selectedPlan) {
            return { success: false, error: 'El plan seleccionado no existe' };
        }

        const finalPrice = typeof customPrice === 'number' && customPrice >= 0
            ? customPrice
            : selectedPlan.monthly_price;

        // 1. Guardar mapeo
        await saveRestaurantPlanMapping(restaurantId, planId);

        // 2. Actualizar restaurante en BD
        const { error: restError } = await (supabase
            .from('restaurants' as any) as any)
            .update({
                unit_price: finalPrice,
                subscription_status: 'active',
            })
            .eq('id', restaurantId);

        if (restError) {
            return { success: false, error: restError.message };
        }

        // Intento de actualizar plan_id en BD
        try {
            await (supabase.from('restaurants' as any) as any)
                .update({ plan_id: planId })
                .eq('id', restaurantId);
        } catch {
            // Ignorar si la columna no existe aún
        }

        // 3. Si tiene suscripción Stripe y el plan tiene stripe_price_id, sincronizar
        const { data: rest } = await (supabase
            .from('restaurants' as any) as any)
            .select('stripe_subscription_id')
            .eq('id', restaurantId)
            .single();

        if (rest?.stripe_subscription_id && selectedPlan.stripe_price_id) {
            try {
                const stripe = await getDynamicStripe();
                const sub = await stripe.subscriptions.retrieve(rest.stripe_subscription_id);
                if (sub.items.data.length > 0) {
                    const itemId = sub.items.data[0].id;
                    await stripe.subscriptions.update(rest.stripe_subscription_id, {
                        items: [{
                            id: itemId,
                            price: selectedPlan.stripe_price_id,
                        }],
                        proration_behavior: 'none',
                    });
                }
            } catch (stripeErr: any) {
                console.warn('Advertencia actualizando Stripe Subscription:', stripeErr?.message);
            }
        }

        revalidatePath('/super-admin/billing');
        revalidatePath('/admin/billing');
        revalidatePath('/[locale]/super-admin/restaurants', 'page');
        return { success: true, planName: selectedPlan.name };
    } catch (err: any) {
        console.error('Error in updateRestaurantPlan:', err);
        return { success: false, error: err.message || 'Error al actualizar el plan' };
    }
}

