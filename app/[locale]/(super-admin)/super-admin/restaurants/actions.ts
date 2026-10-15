'use server';

import { getAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { SubscriptionPlan, DEFAULT_SUBSCRIPTION_PLANS } from '@/lib/subscription-plans';
import {
    getSubscriptionPlans,
    saveRestaurantPlanMapping,
    updateRestaurantPlan
} from '@/actions/plans-admin';
import { inviteRestaurantOwner } from '@/actions/invite-owner';

export async function getRestaurants() {
    try {
        await requireSuperAdmin();
        const supabase = getAdminClient();
        const { data: restaurants, error } = await (supabase
            .from('restaurants' as any) as any)
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching restaurants from DB:', error);
            return { error: error.message };
        }

        if (!restaurants || restaurants.length === 0) {
            return { data: [] };
        }

        // Obtener planes y mapeo de forma segura con el cliente admin (sin fallar si system_settings está vacío)
        let plans: SubscriptionPlan[] = DEFAULT_SUBSCRIPTION_PLANS;
        let plansMap: Record<string, string> = {};

        try {
            const { data: settingsData } = await (supabase
                .from('system_settings' as any) as any)
                .select('key, value')
                .in('key', ['subscription_plans_config', 'restaurant_plans_map']);

            if (settingsData && Array.isArray(settingsData)) {
                const plansRow = settingsData.find((s: any) => s.key === 'subscription_plans_config');
                const mapRow = settingsData.find((s: any) => s.key === 'restaurant_plans_map');

                if (plansRow?.value) {
                    try {
                        const parsed = JSON.parse(plansRow.value);
                        if (Array.isArray(parsed) && parsed.length > 0) plans = parsed;
                    } catch {}
                }

                if (mapRow?.value) {
                    try {
                        const parsedMap = JSON.parse(mapRow.value);
                        if (parsedMap && typeof parsedMap === 'object') plansMap = parsedMap;
                    } catch {}
                }
            }
        } catch (settingsErr) {
            console.warn('Advertencia al cargar configuración de planes:', settingsErr);
        }

        const enriched = restaurants.map((res: any) => {
            const planId = res.plan_id || plansMap[res.id] || (res.unit_price === 99 ? 'plan_exo_salon' : 'plan_exo_salon');
            const plan = plans.find(p => p.id === planId) || plans[0];
            return {
                ...res,
                plan_id: planId,
                plan_name: plan?.name || (res.unit_price ? `Plan $${res.unit_price}/mes` : 'Plan Salón & Cocina'),
                plan_category: plan?.category || 'salon',
                plan,
            };
        });

        return { data: enriched };
    } catch (e: any) {
        console.error('Error in getRestaurants:', e);
        return { error: e.message || 'Unauthorized' };
    }
}

export async function createRestaurant(formData: {
    name: string;
    slug: string;
    logo_url?: string;
    plan_id?: string;
    custom_price?: number;
    owner_email?: string;
    seed_demo_data?: boolean;
}) {
    try {
        await requireSuperAdmin();
        if (!formData.name || !formData.slug) {
            return { error: 'Nombre y slug son requeridos' };
        }

        const cleanSlug = formData.slug
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

        if (!cleanSlug) {
            return { error: 'El identificador (slug) no es válido. Usa sólo letras, números y guiones.' };
        }

        const supabase = getAdminClient();

        // Verificar si el slug ya existe antes de insertar para evitar error 500 de Postgres
        const { data: existingSlug } = await (supabase
            .from('restaurants' as any) as any)
            .select('id, name')
            .eq('slug', cleanSlug)
            .maybeSingle();

        if (existingSlug) {
            return { error: `El slug "${cleanSlug}" ya está en uso por "${existingSlug.name}". Por favor elige un identificador único.` };
        }

        // Obtener el plan seleccionado
        const plans = await getSubscriptionPlans();
        const selectedPlan = plans.find(p => p.id === formData.plan_id) || plans[0];
        const unitPrice = typeof formData.custom_price === 'number' && formData.custom_price >= 0
            ? formData.custom_price
            : (selectedPlan?.monthly_price ?? 99);

        const insertPayload: any = {
            name: formData.name.trim(),
            slug: cleanSlug,
            logo_url: formData.logo_url || null,
            is_active: true,
            unit_price: unitPrice,
            subscription_status: 'active',
            plan_quantity: 1,
            plan_id: selectedPlan?.id || 'plan_exo_salon',
        };

        const { data, error } = await (supabase
            .from('restaurants' as any) as any)
            .insert([insertPayload])
            .select()
            .single();

        if (error) {
            return { error: error.message };
        }

        // Asociar plan_id al restaurante en el mapeo de system_settings
        if (selectedPlan && data?.id) {
            await saveRestaurantPlanMapping(data.id, selectedPlan.id);
        }

        // Sembrar datos iniciales (Mesas y Categorías) para evitar restaurante vacío en frío
        if (formData.seed_demo_data !== false && data?.id) {
            try {
                await (supabase.from('tables' as any) as any).insert([
                    { restaurant_id: data.id, number: '1', capacity: 4 },
                    { restaurant_id: data.id, number: '2', capacity: 4 },
                    { restaurant_id: data.id, number: '3', capacity: 2 },
                    { restaurant_id: data.id, number: '4', capacity: 4 },
                    { restaurant_id: data.id, number: '5', capacity: 6 },
                    { restaurant_id: data.id, number: '6', capacity: 4 },
                ]);

                await (supabase.from('categories' as any) as any).insert([
                    { restaurant_id: data.id, name: 'Platos Principales', sort_order: 1 },
                    { restaurant_id: data.id, name: 'Bebidas', sort_order: 2 },
                    { restaurant_id: data.id, name: 'Postres', sort_order: 3 },
                ]);
            } catch (seedErr) {
                console.warn('Advertencia al sembrar datos iniciales:', seedErr);
            }
        }

        // Si se especificó correo de dueño, enviar invitación automáticamente
        let inviteResult = null;
        if (formData.owner_email && formData.owner_email.includes('@') && data?.id) {
            try {
                inviteResult = await inviteRestaurantOwner(formData.owner_email.trim(), data.id, 'es');
            } catch (invErr: any) {
                console.warn('Advertencia invitando dueño durante creación:', invErr);
                inviteResult = { error: invErr?.message || 'Error al enviar invitación' };
            }
        }

        revalidatePath('/[locale]/super-admin/restaurants', 'page');
        revalidatePath('/super-admin/billing');
        return { data, inviteResult };
    } catch (e: any) {
        return { error: e.message || 'Unauthorized' };
    }
}

export async function toggleRestaurantStatus(id: string, is_active: boolean) {
    try {
        await requireSuperAdmin();
        if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            return { error: 'ID de restaurante inválido' };
        }

        const supabase = getAdminClient();

        const { error } = await (supabase
            .from('restaurants' as any) as any)
            .update({ is_active })
            .eq('id', id);

        if (error) {
            return { error: error.message };
        }

        revalidatePath('/[locale]/super-admin/restaurants', 'page');
        return { success: true };
    } catch (e: any) {
        return { error: e.message || 'Unauthorized' };
    }
}

export async function uploadRestaurantLogo(formData: FormData) {
    try {
        await requireSuperAdmin();
        const file = formData.get('file') as File;
        const restaurantId = formData.get('restaurantId') as string;

        if (!file || !restaurantId) {
            return { error: 'Faltan datos (archivo o ID)' };
        }

        if (!restaurantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            return { error: 'ID de restaurante inválido' };
        }

        const supabase = getAdminClient();
        const fileName = `logos/${restaurantId}-${Date.now()}.png`;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error: uploadError } = await supabase.storage
            .from('restaurants')
            .upload(fileName, buffer, {
                contentType: 'image/png',
                upsert: true
            });

        if (uploadError) {
            console.error('Upload Error:', uploadError);
            return { error: 'Error al subir imagen: ' + uploadError.message };
        }

        const { data: { publicUrl } } = supabase.storage
            .from('restaurants')
            .getPublicUrl(fileName);

        const { error: dbError } = await (supabase
            .from('restaurants' as any) as any)
            .update({ logo_url: publicUrl })
            .eq('id', restaurantId);

        if (dbError) {
            return { error: 'Error al actualizar base de datos: ' + dbError.message };
        }

        revalidatePath('/[locale]/super-admin/restaurants');
        return { success: true, url: publicUrl };
    } catch (err: any) {
        console.error('Server Action Error:', err);
        return { error: 'Error inesperado: ' + err.message };
    }
}

export async function deleteRestaurant(id: string) {
    try {
        await requireSuperAdmin();
        if (!id || !id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            return { error: 'ID de restaurante inválido' };
        }

        const supabase = getAdminClient();

        const { error } = await (supabase
            .from('restaurants' as any) as any)
            .delete()
            .eq('id', id);

        if (error) {
            return { error: error.message };
        }

        // Limpieza de mapeo en system_settings para evitar IDs huérfanos
        try {
            const { data: settingsData } = await (supabase
                .from('system_settings' as any) as any)
                .select('value')
                .eq('key', 'restaurant_plans_map')
                .single();

            if (settingsData?.value) {
                const map = JSON.parse(settingsData.value);
                if (map[id]) {
                    delete map[id];
                    await (supabase.from('system_settings' as any) as any).upsert({
                        key: 'restaurant_plans_map',
                        value: JSON.stringify(map),
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'key' });
                }
            }
        } catch (cleanErr) {
            console.warn('Advertencia al limpiar mapeo de plan:', cleanErr);
        }

        revalidatePath('/[locale]/super-admin/restaurants', 'page');
        revalidatePath('/super-admin/billing');
        return { success: true };
    } catch (e: any) {
        return { error: e.message || 'Unauthorized' };
    }
}
