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
            const { data: existingProd, error: checkError } = await (supabaseAdmin
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

            const { data: dbIngredients, error: ingError } = await (supabaseAdmin
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
    if (!restaurantId || !restaurantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return [];
    }
    const supabase = await createClient();
    console.log(`[getMenuWithSchedule] Fetching for Restaurant: ${restaurantId}, Day: ${dayOfWeek}`);

    // 1. Fetch active products and today's scheduling rules in parallel (1 single network roundtrip)
    const [prodRes, schedRes] = await Promise.all([
        (supabase.from('products') as any)
            .select('*, modifier_groups:product_modifier_groups(modifier_group:modifier_groups(*, options:modifiers(*))), ingredients:product_ingredients(ingredient_id, is_removable, ingredient:ingredients(id, name))')
            .eq('restaurant_id', restaurantId)
            .eq('is_available', true),
        (supabase.from('product_availability' as any) as any)
            .select('product_id, is_active')
            .eq('restaurant_id', restaurantId)
            .eq('day_of_week', dayOfWeek)
    ]);

    if (prodRes.error) throw prodRes.error;
    if (schedRes.error) throw schedRes.error;

    const products = (prodRes.data as any[]) || [];
    if (products.length === 0) return [];

    // 2. Build O(1) Set of products explicitly disabled for today
    const disabledTodayIds = new Set<string>(
        ((schedRes.data as any[]) || [])
            .filter((s: any) => s.is_active === false)
            .map((s: any) => s.product_id)
    );

    const validProducts = products.filter((product: any) => !disabledTodayIds.has(product.id));

    // Format modifier_groups and removable_ingredients for instant Zero-Lag usage on client
    const formattedProducts = validProducts.map((p: any) => ({
        ...p,
        modifier_groups: p.modifier_groups?.map((pmg: any) => ({
            id: pmg.modifier_group?.id,
            name: pmg.modifier_group?.name,
            min_selections: pmg.modifier_group?.min_selections ?? 0,
            max_selections: pmg.modifier_group?.max_selections ?? null,
            is_required: !!pmg.modifier_group?.is_required,
            options: (pmg.modifier_group?.options || []).map((m: any) => ({
                id: m.id,
                name: m.name,
                price: Number(m.price_extra || 0),
                is_available: m.is_available ?? true
            }))
        })) || [],
        removable_ingredients: p.ingredients
            ?.filter((pi: any) => pi.is_removable && pi.ingredient)
            ?.map((pi: any) => ({
                id: pi.ingredient.id,
                name: pi.ingredient.name
            })) || []
    }));

    console.log(`[getMenuWithSchedule] Returning ${formattedProducts.length} pre-formatted products.`);
    return formattedProducts;
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

export async function bulkInsertIngredientsAction(
    restaurantId: string,
    ingredients: string[]
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

        // 1. Get existing ingredients for this restaurant
        const { data: existingIngredients, error: ingError } = await (supabase
            .from('ingredients' as any) as any)
            .select('name')
            .eq('restaurant_id', targetRestaurantId);

        if (ingError) throw ingError;

        const existingNames = new Set<string>();
        if (existingIngredients) {
            existingIngredients.forEach((ing: any) => {
                existingNames.add(ing.name.toLowerCase().trim());
            });
        }

        // 2. Filter out duplicates from input and those that already exist in database
        const uniqueInputIngredients = Array.from(
            new Set(
                ingredients
                    .map(name => name.trim())
                    .filter(name => name.length > 0)
            )
        );

        const newIngredients = uniqueInputIngredients.filter(
            name => !existingNames.has(name.toLowerCase())
        );

        if (newIngredients.length === 0) {
            return { success: true, count: 0, message: 'Todos los ingredientes ya existen o el archivo está vacío.' };
        }

        // 3. Build ingredient inserts
        const ingredientInserts = newIngredients.map(name => ({
            restaurant_id: targetRestaurantId,
            name: name
        }));

        // 4. Bulk insert ingredients
        const { error: insertError } = await (supabaseAdmin
            .from('ingredients' as any) as any)
            .insert(ingredientInserts);

        if (insertError) throw insertError;

        revalidatePath('/admin/ingredients');
        return { success: true, count: newIngredients.length };

    } catch (e: any) {
        console.error('Error in bulkInsertIngredientsAction:', e);
        return { error: e.message || 'Error al importar los ingredientes', success: false };
    }
}

