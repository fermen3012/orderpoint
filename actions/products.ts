'use server'

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/server-admin';
import { revalidatePath } from 'next/cache';

interface IngredientSelection {
    ingredient_id: string;
    is_removable: boolean;
}

interface ProductInput {
    id?: string;
    restaurant_id: string;
    name: string;
    description?: string | null;
    price: number;
    category_id?: string | null;
    image_url?: string | null;
    is_available: boolean;
}

export async function saveProduct(product: ProductInput, ingredients: IngredientSelection[]) {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return { error: 'Unauthorized', success: false };
    }

    try {
        let productId: string;

        if (product.id) {
            // Update existing product
            const { error: updateError } = await supabaseAdmin
                .from('products')
                .update({
                    name: product.name,
                    description: product.description,
                    price: product.price,
                    category_id: product.category_id,
                    image_url: product.image_url,
                    is_available: product.is_available
                })
                .eq('id', product.id);

            if (updateError) throw updateError;
            productId = product.id;

        } else {
            // Create new product
            const { data: newProduct, error: insertError } = await supabaseAdmin
                .from('products')
                .insert({
                    restaurant_id: product.restaurant_id,
                    name: product.name,
                    description: product.description,
                    price: product.price,
                    category_id: product.category_id,
                    image_url: product.image_url,
                    is_available: product.is_available
                })
                .select()
                .single();

            if (insertError) throw insertError;
            productId = newProduct.id;
        }

        // Manage Ingredients
        // 1. Delete existing (for updates)
        const { error: deleteError } = await supabaseAdmin
            .from('product_ingredients')
            .delete()
            .eq('product_id', productId);

        if (deleteError) throw deleteError;

        // 2. Insert new ones
        if (ingredients.length > 0) {
            const { error: ingredientsError } = await supabaseAdmin
                .from('product_ingredients')
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
        return { error: error.message || 'Error saving product', success: false };
    }
}
