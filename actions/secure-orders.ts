'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/server-admin';
import { revalidatePath } from 'next/cache';
import { requireProfile } from '@/lib/auth/guards';

interface OrderItemInput {
    product_id: string;
    quantity: number;
    modifier_option_ids: string[]; // Option IDs (corresponds to modifier table IDs)
    removed_ingredients: string[]; // Ingredient IDs
}

interface CreateOrderInput {
    restaurant_id: string;
    order_type: 'dine_in' | 'takeout';
    items: OrderItemInput[];
}

export async function createSecureOrder(input: CreateOrderInput) {
    try {
        const profile = await requireProfile();

        // Validate allowed roles for placing orders
        const allowedRoles = ['kiosk', 'mesera', 'admin', 'owner'];
        if (!allowedRoles.includes(profile.role) && !profile.is_super_admin) {
            throw new Error('Forbidden: Unauthorized role for placing orders');
        }

        // Enforce same restaurant validation for non-super-admins
        const finalRestaurantId = profile.is_super_admin ? input.restaurant_id : profile.restaurant_id!;
        if (!finalRestaurantId) {
            throw new Error("Missing restaurant association");
        }

        // Validate UUID format
        if (!finalRestaurantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            throw new Error("Invalid restaurant ID format");
        }

        if (input.items.length === 0) {
            throw new Error("Invalid order data: No items provided");
        }

        const supabase = await createClient();

        // 1. Obtener IDs únicos para consultas masivas y validar UUIDs antes de consultar BD
        const uniqueProductIds = Array.from(new Set(input.items.map(i => i.product_id)));
        const uniqueModifierIds = Array.from(new Set(input.items.flatMap(i => i.modifier_option_ids)));
        const uniqueIngredientIds = Array.from(
            new Set(
                input.items
                    .flatMap(i => i.removed_ingredients || [])
                    .filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
            )
        );

        for (const prodId of uniqueProductIds) {
            if (!prodId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                throw new Error("Invalid product ID format");
            }
        }

        for (const modId of uniqueModifierIds) {
            if (!modId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                throw new Error("Invalid modifier ID format");
            }
        }

        // 2. Ejecutar validaciones de Restaurante, Productos, Modificadores, Ingredientes y Correlativo en PARALELO (1 solo viaje de red)
        const [restRes, prodRes, modsRes, ingsRes, numRes] = await Promise.all([
            (supabase.from('restaurants' as any) as any)
                .select('is_active, name')
                .eq('id', finalRestaurantId)
                .single(),
            (supabase.from('products' as any) as any)
                .select('id, name, price, is_available')
                .in('id', uniqueProductIds)
                .eq('restaurant_id', finalRestaurantId)
                .eq('is_available', true),
            uniqueModifierIds.length > 0
                ? (supabase.from('modifiers' as any) as any)
                    .select(`
                        id,
                        name,
                        price_extra,
                        group_id,
                        modifier_groups (
                            id,
                            name,
                            restaurant_id,
                            product_modifier_groups (
                                product_id
                            )
                        )
                    `)
                    .in('id', uniqueModifierIds)
                : Promise.resolve({ data: [], error: null }),
            uniqueIngredientIds.length > 0
                ? (supabaseAdmin.from('ingredients' as any) as any)
                    .select('id, name')
                    .in('id', uniqueIngredientIds)
                    .eq('restaurant_id', finalRestaurantId)
                : Promise.resolve({ data: [], error: null }),
            (supabase.rpc as any)('get_next_order_number', {
                p_restaurant_id: finalRestaurantId
            })
        ]);

        const ingredientNameById = new Map<string, string>();
        for (const ing of (ingsRes?.data as any[]) || []) {
            if (ing.id && ing.name) {
                ingredientNameById.set(ing.id, ing.name);
            }
        }

        const { data: restaurant, error: restError } = restRes;
        if (restError || !restaurant) {
            throw new Error("No se encontró el restaurante asociado a la orden.");
        }

        if (restaurant.is_active === false) {
            throw new Error("El servicio de este restaurante se encuentra temporalmente suspendido por administración.");
        }

        const { data: products, error: prodError } = prodRes;
        if (prodError || !products || products.length !== uniqueProductIds.length) {
            throw new Error("One or more products are unavailable or do not belong to this restaurant");
        }

        // 3. Validar Modificadores y sus Grupos (Fuente de Verdad)
        let modifiersDB: any[] = [];
        if (uniqueModifierIds.length > 0) {
            const { data: mods, error: modError } = modsRes;
            if (modError || !mods) throw new Error("Error fetching modifiers");

            // Validar que cada modificador pertenezca al restaurante y esté asignado al producto correspondiente
            for (const mod of mods as any) {
                if (mod.modifier_groups?.restaurant_id !== finalRestaurantId) {
                    throw new Error(`Modifier option ${mod.name} does not belong to this restaurant`);
                }

                const productModifiers = mod.modifier_groups?.product_modifier_groups || [];
                const allowedProductIds = productModifiers.map((pm: any) => pm.product_id);

                // Verify that the product under which this modifier is selected actually supports it
                const isUsedForValidProduct = input.items.some(item =>
                    item.modifier_option_ids.includes(mod.id) && allowedProductIds.includes(item.product_id)
                );

                if (!isUsedForValidProduct) {
                    throw new Error(`Modifier option ${mod.name} is not valid for the selected product`);
                }
            }

            modifiersDB = mods;
        }

        const { data: nextNumber, error: numError } = numRes;
        if (numError) throw numError;

        // 4. Calcular Totales y Construir JSON (Server-side price calculation)
        let calculatedTotal = 0;
        const validOrderItems = [];

        for (const item of input.items) {
            const product = (products as any[]).find((p: any) => p.id === item.product_id);
            if (!product) throw new Error(`Producto ${item.product_id} no encontrado`);

            let itemUnitPrice = Number(product.price);

            // Agrupamos las opciones seleccionadas por Group ID
            const modifiersByGroup: Record<string, { groupName: string, options: any[] }> = {};

            for (const modId of item.modifier_option_ids) {
                const modDB = modifiersDB.find(m => m.id === modId);
                if (modDB) {
                    itemUnitPrice += Number(modDB.price_extra);

                    const groupId = modDB.group_id;
                    if (!modifiersByGroup[groupId]) {
                        modifiersByGroup[groupId] = {
                            groupName: modDB.modifier_groups?.name || 'Opciones',
                            options: []
                        };
                    }
                    modifiersByGroup[groupId].options.push({
                         id: modDB.id,
                         name: modDB.name,
                         price: Number(modDB.price_extra)
                    });
                }
            }

            // Convertir el mapa a array para el JSON final
            const modifiersJson = Object.keys(modifiersByGroup).map(groupId => ({
                groupId: groupId,
                groupName: modifiersByGroup[groupId].groupName,
                options: modifiersByGroup[groupId].options
            }));

            calculatedTotal += itemUnitPrice * item.quantity;

            // Resolver los IDs de ingredientes removidos a sus nombres legibles para Cocina y Admin
            const resolvedRemovedIngredients = (item.removed_ingredients || []).map(
                ingIdOrName => ingredientNameById.get(ingIdOrName) || ingIdOrName
            );

            validOrderItems.push({
                order_id: null, // Se asigna después
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: itemUnitPrice,
                modifiers_json: modifiersJson,
                removed_ingredients: resolvedRemovedIngredients
            });
        }

        // 5. Insertar Orden e Items

        // B. Insertar Orden (Con Server-Side Total)
        const { data: order, error: orderError } = await (supabase
            .from('orders' as any) as any)
            .insert({
                restaurant_id: finalRestaurantId,
                total_amount: calculatedTotal,
                status: 'pending',
                order_number: nextNumber,
                order_type: input.order_type,
                source: 'kiosk'
            })
            .select()
            .single();

        if (orderError) throw orderError;

        // C. Insertar Items
        const { error: itemsError } = await (supabase
            .from('order_items' as any) as any)
            .insert(
                validOrderItems.map(item => ({
                    ...item,
                    order_id: (order as any).id
                }))
            );

        if (itemsError) throw itemsError;

        revalidatePath('/admin/orders');

        return { success: true, order };

    } catch (err: any) {
        console.error('Create Secure Order Error:', err);
        return { success: false, error: err.message };
    }
}
