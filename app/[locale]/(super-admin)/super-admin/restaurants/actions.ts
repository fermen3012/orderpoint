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

        // Ejecutar consulta de restaurantes y configuración de planes en paralelo (1 solo viaje de red)
        const [restaurantsRes, settingsRes] = await Promise.all([
            (supabase
                .from('restaurants' as any) as any)
                .select('*')
                .order('created_at', { ascending: false }),
            (supabase
                .from('system_settings' as any) as any)
                .select('key, value')
                .in('key', ['subscription_plans_config', 'restaurant_plans_map'])
        ]);

        const { data: restaurants, error } = restaurantsRes;

        if (error) {
            console.error('Error fetching restaurants from DB:', error);
            return { error: error.message };
        }

        // Procesar planes y mapeo desde la respuesta paralela
        let plans: SubscriptionPlan[] = DEFAULT_SUBSCRIPTION_PLANS;
        let plansMap: Record<string, string> = {};

        try {
            const settingsData = settingsRes?.data;
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

        if (!restaurants || restaurants.length === 0) {
            return { data: [], plans };
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

        return { data: enriched, plans };
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

function parseStorageUrl(url: string | null | undefined): { bucket: string; path: string } | null {
    if (!url || typeof url !== 'string') return null;
    const marker = '/storage/v1/object/public/';
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    const afterMarker = url.substring(idx + marker.length).split('?')[0];
    const firstSlash = afterMarker.indexOf('/');
    if (firstSlash === -1) return null;
    const bucket = decodeURIComponent(afterMarker.substring(0, firstSlash));
    const path = decodeURIComponent(afterMarker.substring(firstSlash + 1));
    if (!bucket || !path) return null;
    return { bucket, path };
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

        const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            return { error: 'Formato de archivo no permitido. Usa PNG, JPG o WEBP.' };
        }

        const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
        if (file.size > MAX_SIZE_BYTES) {
            return { error: 'El archivo excede el tamaño máximo permitido de 5MB.' };
        }

        const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : 'png';
        const supabase = getAdminClient();

        // Consultar logo anterior para limpiarlo del bucket tras subir el nuevo
        const { data: currentRest } = await (supabase
            .from('restaurants' as any) as any)
            .select('logo_url')
            .eq('id', restaurantId)
            .maybeSingle();

        const fileName = `logos/${restaurantId}-${Date.now()}.${ext}`;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error: uploadError } = await supabase.storage
            .from('restaurants')
            .upload(fileName, buffer, {
                contentType: file.type,
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

        // Eliminar archivos de logo anteriores de este restaurante para no ocupar espacio innecesario
        try {
            const oldPaths = new Set<string>();
            const parsedOld = parseStorageUrl(currentRest?.logo_url);
            if (parsedOld && parsedOld.bucket === 'restaurants' && parsedOld.path !== fileName) {
                oldPaths.add(parsedOld.path);
            }
            const { data: existingLogos } = await supabase.storage
                .from('restaurants')
                .list('logos', { search: restaurantId });
            if (existingLogos) {
                for (const item of existingLogos) {
                    if (item.name && item.name.startsWith(`${restaurantId}-`)) {
                        const fullPath = `logos/${item.name}`;
                        if (fullPath !== fileName) {
                            oldPaths.add(fullPath);
                        }
                    }
                }
            }
            if (oldPaths.size > 0) {
                await supabase.storage.from('restaurants').remove(Array.from(oldPaths));
            }
        } catch (cleanupErr) {
            console.warn('Advertencia al limpiar logo anterior:', cleanupErr);
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

        // 1. Recolectar todas las imágenes del restaurante (logo, productos y categorías) ANTES de borrar de la base de datos
        const [
            restRes,
            prodsRes,
            catsRes,
            otherProdsRes,
            otherCatsRes,
            ordersRes,
            groupsRes,
            profilesRes
        ] = await Promise.all([
            (supabase.from('restaurants' as any) as any).select('id, logo_url').eq('id', id).maybeSingle(),
            (supabase.from('products' as any) as any).select('id, image_url').eq('restaurant_id', id),
            (supabase.from('categories' as any) as any).select('id, image_url').eq('restaurant_id', id),
            (supabase.from('products' as any) as any).select('image_url').neq('restaurant_id', id).not('image_url', 'is', null),
            (supabase.from('categories' as any) as any).select('image_url').neq('restaurant_id', id).not('image_url', 'is', null),
            (supabase.from('orders' as any) as any).select('id').eq('restaurant_id', id),
            (supabase.from('modifier_groups' as any) as any).select('id').eq('restaurant_id', id),
            (supabase.from('profiles' as any) as any).select('id, is_super_admin').eq('restaurant_id', id)
        ]);

        // URLs en uso por OTROS restaurantes (para nunca borrar una foto compartida)
        const sharedUrls = new Set<string>();
        for (const p of (otherProdsRes?.data || [])) {
            if (p.image_url) sharedUrls.add(p.image_url);
        }
        for (const c of (otherCatsRes?.data || [])) {
            if (c.image_url) sharedUrls.add(c.image_url);
        }

        // Agrupar rutas de archivos por bucket de Supabase Storage
        const bucketPathsMap = new Map<string, Set<string>>();
        const addStoragePath = (bucket: string, path: string) => {
            if (!bucketPathsMap.has(bucket)) {
                bucketPathsMap.set(bucket, new Set<string>());
            }
            bucketPathsMap.get(bucket)!.add(path);
        };

        // Logo del restaurante
        if (restRes?.data?.logo_url) {
            const parsed = parseStorageUrl(restRes.data.logo_url);
            if (parsed) addStoragePath(parsed.bucket, parsed.path);
        }

        // Buscar cualquier archivo de logo en el bucket 'restaurants' bajo el prefijo del ID
        try {
            const { data: logoFiles } = await supabase.storage
                .from('restaurants')
                .list('logos', { search: id });
            if (logoFiles) {
                for (const lf of logoFiles) {
                    if (lf.name && (lf.name.startsWith(`${id}-`) || lf.name.startsWith(`${id}.`))) {
                        addStoragePath('restaurants', `logos/${lf.name}`);
                    }
                }
            }
        } catch (logoListErr) {
            console.warn('Advertencia listando logos del restaurante:', logoListErr);
        }

        // Fotos de productos del restaurante
        for (const prod of (prodsRes?.data || [])) {
            if (prod.image_url && !sharedUrls.has(prod.image_url)) {
                const parsed = parseStorageUrl(prod.image_url);
                if (parsed) addStoragePath(parsed.bucket, parsed.path);
            }
        }

        // Fotos de categorías del restaurante
        for (const cat of (catsRes?.data || [])) {
            if (cat.image_url && !sharedUrls.has(cat.image_url)) {
                const parsed = parseStorageUrl(cat.image_url);
                if (parsed) addStoragePath(parsed.bucket, parsed.path);
            }
        }

        // 2. Eliminar todos los archivos recolectados de los buckets de Supabase Storage
        for (const [bucket, pathsSet] of bucketPathsMap.entries()) {
            const paths = Array.from(pathsSet);
            if (paths.length > 0) {
                const { error: storageErr } = await supabase.storage.from(bucket).remove(paths);
                if (storageErr) {
                    console.warn(`Advertencia al eliminar archivos del bucket "${bucket}":`, storageErr);
                }
            }
        }

        // 3. Recolectar cuentas de usuarios (Owner, Cocina, Kiosko, Meseras) vinculadas al restaurante
        const userIdsToDelete = new Set<string>();
        const superAdminIds = new Set<string>();

        for (const prof of (profilesRes?.data || [])) {
            if (prof.is_super_admin) {
                superAdminIds.add(prof.id);
            } else if (prof.id) {
                userIdsToDelete.add(prof.id);
            }
        }

        try {
            const { data: authList } = await supabase.auth.admin.listUsers();
            if (authList?.users) {
                for (const u of authList.users) {
                    if (u.user_metadata?.restaurant_id === id && !superAdminIds.has(u.id)) {
                        userIdsToDelete.add(u.id);
                    }
                }
            }
        } catch (authListErr) {
            console.warn('Advertencia al listar usuarios de Auth del restaurante:', authListErr);
        }

        // 4. Eliminar todos los registros hijos de la base de datos en orden jerárquico estricto
        const productIds = (prodsRes?.data || []).map((p: any) => p.id);
        const orderIds = (ordersRes?.data || []).map((o: any) => o.id);
        const groupIds = (groupsRes?.data || []).map((g: any) => g.id);

        // Desvincular referencias opcionales de mesera antes de borrar órdenes, mesas y usuarios
        await Promise.all([
            (supabase.from('orders' as any) as any).update({ waitress_id: null, table_id: null }).eq('restaurant_id', id),
            (supabase.from('tables' as any) as any).update({ waitress_id: null }).eq('restaurant_id', id)
        ]);

        // Tablas hoja / intermedias
        if (orderIds.length > 0) {
            await (supabase.from('order_items' as any) as any).delete().in('order_id', orderIds);
        }
        if (productIds.length > 0) {
            await Promise.all([
                (supabase.from('order_items' as any) as any).delete().in('product_id', productIds),
                (supabase.from('product_ingredients' as any) as any).delete().in('product_id', productIds),
                (supabase.from('product_modifier_groups' as any) as any).delete().in('product_id', productIds),
                (supabase.from('product_availability' as any) as any).delete().in('product_id', productIds)
            ]);
        }
        if (groupIds.length > 0) {
            await Promise.all([
                (supabase.from('product_modifier_groups' as any) as any).delete().in('group_id', groupIds),
                (supabase.from('modifiers' as any) as any).delete().in('group_id', groupIds)
            ]);
        }

        // Tablas de segundo nivel con restaurant_id directo
        await Promise.all([
            (supabase.from('product_availability' as any) as any).delete().eq('restaurant_id', id),
            (supabase.from('orders' as any) as any).delete().eq('restaurant_id', id),
            (supabase.from('products' as any) as any).delete().eq('restaurant_id', id),
            (supabase.from('modifier_groups' as any) as any).delete().eq('restaurant_id', id),
            (supabase.from('ingredients' as any) as any).delete().eq('restaurant_id', id),
            (supabase.from('tables' as any) as any).delete().eq('restaurant_id', id)
        ]);

        await (supabase.from('categories' as any) as any).delete().eq('restaurant_id', id);
        await (supabase.from('profiles' as any) as any).delete().eq('restaurant_id', id).eq('is_super_admin', false);

        // Eliminar usuarios de Supabase Auth vinculados a este restaurante
        for (const uid of userIdsToDelete) {
            try {
                await supabase.auth.admin.deleteUser(uid);
            } catch (delUserErr) {
                console.warn(`Advertencia al eliminar usuario Auth ${uid}:`, delUserErr);
            }
        }

        // 5. Eliminar el registro raíz del restaurante
        const { error } = await (supabase
            .from('restaurants' as any) as any)
            .delete()
            .eq('id', id);

        if (error) {
            return { error: error.message };
        }

        // 6. Limpieza de mapeo en system_settings para evitar IDs huérfanos
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
        revalidatePath('/[locale]/(super-admin)/super-admin/users', 'page');
        return { success: true };
    } catch (e: any) {
        return { error: e.message || 'Unauthorized' };
    }
}
