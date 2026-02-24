'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// Tipos requeridos para reconstruir el JSON exacto que espera el Frontend
interface ModifierOptionDB {
    id: string;
    name: string;
    price_adjustment: number;
    modifier_group_id: string;
    modifier_groups: {
        id: string;
        name: string;
    };
}

interface OrderItemInput {
    product_id: string;
    quantity: number;
    modifier_option_ids: string[]; // Solo enviamos los IDs de las opciones seleccionadas
    removed_ingredients: string[]; // IDs
}

interface CreateOrderInput {
    restaurant_id: string;
    order_type: 'dine_in' | 'takeout';
    items: OrderItemInput[];
}

export async function createSecureOrder(input: CreateOrderInput) {
    const supabase = await createClient();

    try {
        if (!input.restaurant_id || input.items.length === 0) {
            throw new Error("Invalid order data");
        }

        // 1. Obtener IDs para consultas masivas
        const productIds = input.items.map(i => i.product_id);
        const allModifierIds = input.items.flatMap(i => i.modifier_option_ids);

        // 2. Consultar Productos (Fuente de Verdad de Precios)
        const { data: products, error: prodError } = await (supabase
            .from('products' as any) as any)
            .select('id, name, price, is_available')
            .in('id', productIds)
            .eq('restaurant_id', input.restaurant_id);

        if (prodError || !products) throw new Error("Error fetching products");

        // 3. Consultar Modificadores y sus Grupos (Fuente de Verdad)
        let modifiersDB: ModifierOptionDB[] = [];
        if (allModifierIds.length > 0) {
            const { data: mods, error: modError } = await (supabase
                .from('modifier_options' as any) as any)
                .select('id, name, price_adjustment, modifier_group_id, modifier_groups (id, name)')
                .in('id', allModifierIds);

            if (modError) throw new Error("Error fetching modifiers");
            modifiersDB = mods as any;
        }

        // 4. Calcular Totales y Construir JSON
        let calculatedTotal = 0;
        const validOrderItems = [];

        for (const item of input.items) {
            const product = (products as any[]).find((p: any) => p.id === item.product_id);
            if (!product) throw new Error(`Producto ${item.product_id} no encontrado`);
            // if (!product.is_available) throw new Error(`Producto ${product.name} no está disponible`); // Opcional: strict check

            let itemUnitPrice = Number(product.price);

            // Reconstruir la estructura SelectedModifier[] para el JSON
            // Agrupamos las opciones seleccionadas por Group ID
            const modifiersByGroup: Record<string, { groupName: string, options: any[] }> = {};

            for (const modId of item.modifier_option_ids) {
                const modDB = modifiersDB.find(m => m.id === modId);
                if (modDB) {
                    itemUnitPrice += Number(modDB.price_adjustment);

                    const groupId = modDB.modifier_group_id;
                    if (!modifiersByGroup[groupId]) {
                        modifiersByGroup[groupId] = {
                            groupName: modDB.modifier_groups?.name || 'Opciones',
                            options: []
                        };
                    }
                    modifiersByGroup[groupId].options.push({
                        id: modDB.id,
                        name: modDB.name,
                        price: Number(modDB.price_adjustment)
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

            validOrderItems.push({
                order_id: null, // Se asigna después
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: itemUnitPrice,
                modifiers_json: modifiersJson,
                removed_ingredients: item.removed_ingredients
            });
        }

        // 5. Transacción de Base de Datos

        // A. Obtener número de orden
        const { data: nextNumber, error: numError } = await (supabase.rpc as any)('get_next_order_number', {
            p_restaurant_id: input.restaurant_id
        });
        if (numError) throw numError;

        // B. Insertar Orden (Con Server-Side Total)
        const { data: order, error: orderError } = await (supabase
            .from('orders' as any) as any)
            .insert({
                restaurant_id: input.restaurant_id,
                total_amount: calculatedTotal,
                status: 'pending',
                order_number: nextNumber,
                order_type: input.order_type
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
