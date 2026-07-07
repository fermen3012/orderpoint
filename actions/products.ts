'use server'

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/server-admin';
import { Database } from '@/lib/supabase/types';
import { revalidatePath } from 'next/cache';
import { requireRestaurantRole } from '@/lib/auth/guards';

interface IngredientSelection {
    ingredient_id: string;
    is_removable: boolean;
}

interface ProductInput {
    id?: string;
    restaurant_id: string;
    name: any;
    description?: any | null;
    price: number;
    category_id?: string | null;
    image_url?: string | null;
    is_available: boolean;
}

export async function saveProduct(product: ProductInput, ingredients: IngredientSelection[]) {
    try {
        const profile = await requireRestaurantRole(['admin', 'owner']);
        const supabase = await createClient();

        // If user is not super-admin, override client restaurant_id with the user's profile restaurant_id
        if (!profile.is_super_admin) {
            product.restaurant_id = profile.restaurant_id!;
        }

        // Validate UUIDs
        if (!product.restaurant_id || !product.restaurant_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            return { error: 'ID de restaurante inválido', success: false };
        }

        if (product.category_id && !product.category_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            return { error: 'ID de categoría inválido', success: false };
        }

        let productId: string;

        if (product.id) {
            if (!product.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                return { error: 'ID de producto inválido', success: false };
            }

            // Verify product belongs to the user's restaurant before modifying it
            const { data: existingProd, error: checkError } = await (supabase
                .from('products' as any) as any)
                .select('restaurant_id')
                .eq('id', product.id)
                .single();

            if (checkError || !existingProd) {
                return { error: 'Producto no encontrado', success: false };
            }

            if ((existingProd as any).restaurant_id !== product.restaurant_id) {
                return { error: 'No tiene permisos para modificar este producto', success: false };
            }

            // Update existing product
            const updateData: Database['public']['Tables']['products']['Update'] = {
                name: product.name,
                description: product.description,
                price: product.price,
                category_id: product.category_id,
                image_url: product.image_url,
                is_available: product.is_available
            };

            const { error: updateError } = await (supabaseAdmin
                .from('products' as any) as any)
                .update(updateData)
                .eq('id', product.id);

            if (updateError) throw updateError;
            productId = product.id;

        } else {
            // Create new product
            const insertData: Database['public']['Tables']['products']['Insert'] = {
                restaurant_id: product.restaurant_id,
                name: product.name,
                description: product.description,
                price: product.price,
                category_id: product.category_id,
                image_url: product.image_url,
                is_available: product.is_available
            };

            const { data: newProduct, error: insertError } = await (supabaseAdmin
                .from('products' as any) as any)
                .insert(insertData)
                .select()
                .single();

            if (insertError) throw insertError;
            productId = newProduct.id;
        }

        // Validate that all associated ingredients belong to the target restaurant
        if (ingredients.length > 0) {
            const ingredientIds = ingredients.map(ing => ing.ingredient_id);

            for (const ingId of ingredientIds) {
                if (!ingId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                    return { error: 'ID de ingrediente inválido', success: false };
                }
            }

            const { data: dbIngredients, error: ingError } = await (supabase
                .from('ingredients' as any) as any)
                .select('id, restaurant_id')
                .in('id', ingredientIds);

            if (ingError || !dbIngredients) {
                return { error: 'Error al validar ingredientes', success: false };
            }

            const invalid = (dbIngredients as any[]).some(ing => ing.restaurant_id !== product.restaurant_id);
            if (invalid || dbIngredients.length !== ingredientIds.length) {
                return { error: 'Uno o más ingredientes no pertenecen a este restaurante', success: false };
            }
        }

        // Manage Ingredients
        // 1. Delete existing (for updates)
        const { error: deleteError } = await (supabaseAdmin
            .from('product_ingredients' as any) as any)
            .delete()
            .eq('product_id', productId);

        if (deleteError) throw deleteError;

        // 2. Insert new ones
        if (ingredients.length > 0) {
            const { error: ingredientsError } = await (supabaseAdmin
                .from('product_ingredients' as any) as any)
                .insert(
                    ingredients.map(ing => ({
                        product_id: productId,
                        ingredient_id: ing.ingredient_id,
                        is_removable: ing.is_removable
                    }))
                );

            if (ingredientsError) {
                console.error('Error in product_ingredients insert:', ingredientsError);
                throw ingredientsError;
            }
        }

        revalidatePath('/admin/products');
        return { success: true, productId };

    } catch (error: any) {
        console.error('Error saving product:', error);
        return { error: error.message || 'Error al guardar el producto', success: false };
    }
}


export async function getMenuWithSchedule(restaurantId: string, dayOfWeek: number) {
    const supabase = await createClient();
    console.log(`[getMenuWithSchedule] Fetching for Restaurant: ${restaurantId}, Day: ${dayOfWeek}`);

    // 1. Get ALL active products for the restaurant
    const { data: products, error: prodError } = await (supabase
        .from('products') as any)
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_available', true);

    if (prodError) throw prodError;

    // 2. Get scheduling rules for these products
    const productIds = (products as any[]).map(p => p.id);
    if (productIds.length === 0) return [];

    const { data: schedules, error: schedError } = await (supabase
        .from('product_availability' as any) as any)
        .select('product_id, day_of_week, is_active')
        .in('product_id', productIds);

    if (schedError) throw schedError;

    // 3. Filter in memory
    // Rule:
    // - If a product has NO records in 'product_availability', it is AVAILABLE.
    // - If it HAS records, check if there is a record for THIS day with is_active=true.
    console.log(`[getMenuWithSchedule] Validating ${products.length} products against ${schedules?.length || 0} rules.`);

    const validProducts = products.filter((product: any) => {
        const productSchedules = (schedules || []).filter((s: any) => s.product_id === product.id);

        // Case A: No schedule at all -> Available
        if (productSchedules.length === 0) return true;

        // Case B: Has schedule -> Check for today's record
        const todayRule = productSchedules.find((s: any) => s.day_of_week === dayOfWeek);

        const isKept = todayRule ? todayRule.is_active : true;
        if (!isKept) {
            console.log(`[getMenuWithSchedule] Hiding product ${product.name} (ID: ${product.id}) because is_active=${todayRule?.is_active} for day ${dayOfWeek}`);
        }
        return isKept;
    });

    console.log(`[getMenuWithSchedule] Returning ${validProducts.length} products.`);
    return validProducts;
}

export async function createCategoryAction(name: string, restaurantId: string): Promise<any> {
    try {
        const profile = await requireRestaurantRole(['admin', 'owner']);
        
        let targetRestaurantId = restaurantId;
        if (!profile.is_super_admin) {
            targetRestaurantId = profile.restaurant_id!;
        }

        if (!targetRestaurantId || !targetRestaurantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            return { error: 'ID de restaurante inválido', success: false };
        }

        const supabase = await createClient();
        const { count } = await (supabase
            .from('categories' as any) as any)
            .select('*', { count: 'exact', head: true })
            .eq('restaurant_id', targetRestaurantId);

        const { data, error } = await (supabaseAdmin
            .from('categories' as any) as any)
            .insert({
                name,
                restaurant_id: targetRestaurantId,
                sort_order: (count || 0) + 1
            })
            .select()
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (e: any) {
        console.error('Error creating category action:', e);
        return { error: e.message || 'Error al crear la categoría', success: false };
    }
}

export async function createIngredientAction(name: string, restaurantId: string): Promise<any> {
    try {
        const profile = await requireRestaurantRole(['admin', 'owner']);
        
        let targetRestaurantId = restaurantId;
        if (!profile.is_super_admin) {
            targetRestaurantId = profile.restaurant_id!;
        }

        if (!targetRestaurantId || !targetRestaurantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            return { error: 'ID de restaurante inválido', success: false };
        }

        const { data, error } = await (supabaseAdmin
            .from('ingredients' as any) as any)
            .insert({
                name,
                restaurant_id: targetRestaurantId
            })
            .select()
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (e: any) {
        console.error('Error creating ingredient action:', e);
        return { error: e.message || 'Error al crear el ingrediente', success: false };
    }
}

export async function deleteProductAction(productId: string) {
    try {
        const profile = await requireRestaurantRole(['admin', 'owner']);
        
        if (!profile.is_super_admin) {
            const supabase = await createClient();
            const { data } = await (supabase
                .from('products' as any) as any)
                .select('restaurant_id')
                .eq('id', productId)
                .single();
                
            if (!data || (data as any).restaurant_id !== profile.restaurant_id) {
                return { error: 'No tiene permisos para eliminar este producto', success: false };
            }
        }

        const { error } = await (supabaseAdmin
            .from('products' as any) as any)
            .delete()
            .eq('id', productId);

        if (error) throw error;
        return { success: true };
    } catch (e: any) {
        console.error('Error deleting product action:', e);
        return { error: e.message || 'Error al eliminar el producto', success: false };
    }
}

export async function toggleProductAvailabilityAction(productId: string, currentStatus: boolean) {
    try {
        const profile = await requireRestaurantRole(['admin', 'owner']);
        
        if (!profile.is_super_admin) {
            const supabase = await createClient();
            const { data } = await (supabase
                .from('products' as any) as any)
                .select('restaurant_id')
                .eq('id', productId)
                .single();
                
            if (!data || (data as any).restaurant_id !== profile.restaurant_id) {
                return { error: 'No tiene permisos para modificar la disponibilidad', success: false };
            }
        }

        const { error } = await (supabaseAdmin
            .from('products' as any) as any)
            .update({ is_available: !currentStatus })
            .eq('id', productId);

        if (error) throw error;
        return { success: true };
    } catch (e: any) {
        console.error('Error toggling availability action:', e);
        return { error: e.message || 'Error al cambiar la disponibilidad', success: false };
    }
}

export async function bulkInsertProductsAction(
    restaurantId: string,
    products: {
        name: { es: string; en: string };
        description: { es: string; en: string };
        price: number;
        category: string;
    }[]
): Promise<any> {
    try {
        const profile = await requireRestaurantRole(['admin', 'owner']);
        
        let targetRestaurantId = restaurantId;
        if (!profile.is_super_admin) {
            targetRestaurantId = profile.restaurant_id!;
        }

        if (!targetRestaurantId || !targetRestaurantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            return { error: 'ID de restaurante inválido', success: false };
        }

        const supabase = await createClient();

        // 1. Get existing categories for this restaurant
        const { data: existingCategories, error: catError } = await (supabase
            .from('categories' as any) as any)
            .select('id, name')
            .eq('restaurant_id', targetRestaurantId);

        if (catError) throw catError;

        const categoryMap = new Map<string, string>();
        if (existingCategories) {
            existingCategories.forEach((c: any) => {
                categoryMap.set(c.name.toLowerCase().trim(), c.id);
            });
        }

        // Find unique category names from input that are NOT in existingCategories
        const uniqueInputCategories = Array.from(
            new Set(
                products
                    .map(p => (p.category || 'General').trim())
                    .filter(c => c.length > 0)
            )
        );

        const missingCategories = uniqueInputCategories.filter(
            catName => !categoryMap.has(catName.toLowerCase())
        );

        // 2. Create missing categories
        if (missingCategories.length > 0) {
            // Find current next sort order
            const { count } = await (supabase
                .from('categories' as any) as any)
                .select('*', { count: 'exact', head: true })
                .eq('restaurant_id', targetRestaurantId);

            let nextSortOrder = (count || 0) + 1;

            const categoryInserts = missingCategories.map(catName => ({
                name: catName,
                restaurant_id: targetRestaurantId,
                sort_order: nextSortOrder++
            }));

            const { data: newCats, error: insertCatError } = await (supabaseAdmin
                .from('categories' as any) as any)
                .insert(categoryInserts)
                .select();

            if (insertCatError) throw insertCatError;

            if (newCats) {
                newCats.forEach((c: any) => {
                    categoryMap.set(c.name.toLowerCase().trim(), c.id);
                });
            }
        }

        // 3. Build product inserts
        const productInserts = products.map(p => {
            const catNameResolved = (p.category || 'General').trim();
            const categoryId = categoryMap.get(catNameResolved.toLowerCase()) || null;

            return {
                restaurant_id: targetRestaurantId,
                name: p.name,
                description: p.description,
                price: p.price || 0,
                category_id: categoryId,
                is_available: true
            };
        });

        // 4. Bulk insert products
        const { error: insertProductsError } = await (supabaseAdmin
            .from('products' as any) as any)
            .insert(productInserts);

        if (insertProductsError) throw insertProductsError;

        revalidatePath('/admin/products');
        return { success: true, count: products.length };

    } catch (e: any) {
        console.error('Error in bulkInsertProductsAction:', e);
        return { error: e.message || 'Error al importar los platos', success: false };
    }
}
