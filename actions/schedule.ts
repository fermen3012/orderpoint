'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireProfile, requireRestaurantRole } from '@/lib/auth/guards';

export async function getProductSchedule(productId: string) {
    try {
        const profile = await requireProfile();
        const supabase = await createClient();

        if (!productId || !productId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            throw new Error('Invalid product ID format');
        }

        // Verify product belongs to user's restaurant if not super admin
        if (!profile.is_super_admin) {
            const { data: product, error: prodError } = await (supabase
                .from('products' as any) as any)
                .select('restaurant_id')
                .eq('id', productId)
                .single();

            if (prodError || !product || (product as any).restaurant_id !== profile.restaurant_id) {
                throw new Error('Forbidden: Unauthorized product access');
            }
        }

        const { data, error } = await (supabase
            .from('product_availability' as any) as any)
            .select('day_of_week, is_active')
            .eq('product_id', productId);

        if (error) {
            console.error('Error fetching schedule:', error);
            return [];
        }

        return data;
    } catch (e) {
        console.error('getProductSchedule Error:', e);
        return [];
    }
}

export async function toggleProductAvailability(
    productId: string,
    restaurantId: string,
    dayOfWeek: number,
    isActive: boolean
) {
    try {
        const profile = await requireRestaurantRole(['admin', 'owner']);
        const supabase = await createClient();

        // If not super-admin, force the restaurantId from profile
        const targetRestaurantId = profile.is_super_admin ? restaurantId : profile.restaurant_id!;

        // Validate UUIDs
        if (!productId || !productId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            return { success: false, error: 'ID de producto inválido' };
        }
        if (!targetRestaurantId || !targetRestaurantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            return { success: false, error: 'ID de restaurante inválido' };
        }
        if (dayOfWeek < 0 || dayOfWeek > 6) {
            return { success: false, error: 'Día de la semana inválido (debe ser 0-6)' };
        }

        // Verify product ownership
        const { data: product, error: prodError } = await (supabase
            .from('products' as any) as any)
            .select('restaurant_id')
            .eq('id', productId)
            .single();

        if (prodError || !product || (product as any).restaurant_id !== targetRestaurantId) {
            return { success: false, error: 'Acceso no autorizado al producto' };
        }

        // Check if record exists
        const { data: existing } = await (supabase
            .from('product_availability' as any) as any)
            .select('id')
            .eq('product_id', productId)
            .eq('day_of_week', dayOfWeek)
            .single();

        let error;

        if (existing) {
            // Update
            const { error: updateError } = await (supabase
                .from('product_availability' as any) as any)
                .update({ is_active: isActive, updated_at: new Date().toISOString() })
                .eq('id', (existing as any).id);
            error = updateError;
        } else {
            // Insert
            const { error: insertError } = await (supabase
                .from('product_availability' as any) as any)
                .insert({
                    product_id: productId,
                    restaurant_id: targetRestaurantId,
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
    } catch (e: any) {
        console.error('toggleProductAvailability Error:', e);
        return { success: false, error: e.message || 'No autorizado' };
    }
}

export async function applyScheduleToAllDays(
    productId: string,
    restaurantId: string,
    isActive: boolean
) {
    try {
        const profile = await requireRestaurantRole(['admin', 'owner']);
        const supabase = await createClient();

        // If not super-admin, force the restaurantId from profile
        const targetRestaurantId = profile.is_super_admin ? restaurantId : profile.restaurant_id!;

        // Validate UUIDs
        if (!productId || !productId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            return { success: false, error: 'ID de producto inválido' };
        }
        if (!targetRestaurantId || !targetRestaurantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            return { success: false, error: 'ID de restaurante inválido' };
        }

        // Verify product ownership
        const { data: product, error: prodError } = await (supabase
            .from('products' as any) as any)
            .select('restaurant_id')
            .eq('id', productId)
            .single();

        if (prodError || !product || (product as any).restaurant_id !== targetRestaurantId) {
            return { success: false, error: 'Acceso no autorizado al producto' };
        }

        // We need to upsert for days 0-6
        const days = [0, 1, 2, 3, 4, 5, 6];
        const updates = days.map(day => ({
            product_id: productId,
            restaurant_id: targetRestaurantId,
            day_of_week: day,
            is_active: isActive,
            updated_at: new Date().toISOString()
        }));

        const { error } = await (supabase
            .from('product_availability' as any) as any)
            .upsert(updates, { onConflict: 'product_id, day_of_week' });

        if (error) {
            console.error('Error applying to all days:', error);
            return { success: false, error: error.message };
        }

        revalidatePath('/admin/schedule');
        return { success: true };
    } catch (e: any) {
        console.error('applyScheduleToAllDays Error:', e);
        return { success: false, error: e.message || 'No autorizado' };
    }
}
