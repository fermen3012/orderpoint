'use server'

import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/types'

// Types for the Modifiers System
export type Modifier = Database['public']['Tables']['modifiers']['Row'];
export type ModifierGroup = Database['public']['Tables']['modifier_groups']['Row'] & {
    modifiers: Modifier[];
};

export interface ProductWithModifiers extends Database['public']['Tables']['products']['Row'] {
    product_modifier_groups: {
        sort_order: number;
        modifier_groups: ModifierGroup;
    }[];
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

/**
 * Gets a product and all its nested modifier groups and modifiers.
 * Uses the pivot table relationship to fetch the hierarchal structure.
 */
export async function getModifiersByProduct(productId: string) {
    const { data, error } = await supabase
        .from('products')
        .select(`
            *,
            product_modifier_groups (
                sort_order,
                modifier_groups (
                    *,
                    modifiers (*)
                )
            )
        `)
        .eq('id', productId)
        .single();

    if (error) {
        console.error('Error fetching product modifiers:', error);
        return { error: error.message, data: null };
    }

    // Sort the modifier groups according to the pivot table's sort_order
    if (data && data.product_modifier_groups) {
        data.product_modifier_groups.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }

    return { data: data as unknown as ProductWithModifiers, error: null };
}
