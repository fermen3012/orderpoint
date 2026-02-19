'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getProductSchedule(productId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('product_availability')
        .select('day_of_week, is_active')
        .eq('product_id', productId);

    if (error) {
        console.error('Error fetching schedule:', error);
        return [];
    }

    return data;
}

export async function toggleProductAvailability(
    productId: string,
    restaurantId: string,
    dayOfWeek: number,
    isActive: boolean
) {
    const supabase = await createClient();

    // Check if record exists
    const { data: existing } = await supabase
        .from('product_availability')
        .select('id')
        .eq('product_id', productId)
        .eq('day_of_week', dayOfWeek)
        .single();

    let error;

    if (existing) {
        // Update
        const { error: updateError } = await supabase
            .from('product_availability')
            .update({ is_active: isActive, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        error = updateError;
    } else {
        // Insert (Only if we are setting it to FALSE, or if we want to be explicit)
        // Logic: If no record exists, it's available. So if we toggle to TRUE, we might need a record if previously obscured?
        // Actually, to support "Apply to all", we should probably be explicit.

        const { error: insertError } = await supabase
            .from('product_availability')
            .insert({
                product_id: productId,
                restaurant_id: restaurantId,
                day_of_week: dayOfWeek,
                is_active: isActive
            });
        error = insertError;
    }

    if (error) {
        console.error('Error toggling availability DB:', error);
        return { success: false, error: error.message };
    }

    console.log(`[toggleProductAvailability] Success.`);
    revalidatePath('/admin/schedule');
    return { success: true };
}

export async function applyScheduleToAllDays(
    productId: string,
    restaurantId: string,
    isActive: boolean
) {
    const supabase = await createClient();

    // We need to upsert for days 0-6
    const days = [0, 1, 2, 3, 4, 5, 6];
    const updates = days.map(day => ({
        product_id: productId,
        restaurant_id: restaurantId,
        day_of_week: day,
        is_active: isActive,
        updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
        .from('product_availability')
        .upsert(updates, { onConflict: 'product_id, day_of_week' });

    if (error) {
        console.error('Error applying to all days:', error);
        return { success: false, error: error.message };
    }

    revalidatePath('/admin/schedule');
    return { success: true };
}
