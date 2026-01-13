'use server';

import { getAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createRestaurant(formData: { name: string; slug: string; logo_url?: string }) {
    const supabase = getAdminClient();

    const { data, error } = await (supabase
        .from('restaurants') as any)
        .insert([
            {
                name: formData.name,
                slug: formData.slug,
                logo_url: formData.logo_url || null,
                is_active: true
            }
        ])
        .select()
        .single();

    if (error) {
        return { error: error.message };
    }

    revalidatePath('/[locale]/super-admin/restaurants', 'page');
    return { data };
}

export async function toggleRestaurantStatus(id: string, is_active: boolean) {
    const supabase = getAdminClient();

    const { error } = await (supabase
        .from('restaurants') as any)
        .update({ is_active })
        .eq('id', id);

    if (error) {
        return { error: error.message };
    }

    revalidatePath('/[locale]/super-admin/restaurants', 'page');
    return { success: true };
}
