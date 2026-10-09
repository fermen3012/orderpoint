'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/server-admin';
import { requireRestaurantRole } from '@/lib/auth/guards';
import { revalidatePath } from 'next/cache';

interface SaveTableInput {
    id?: string;
    number: string;
    capacity: number;
    waitress_id?: string | null;
    restaurantId: string;
}

export async function saveTableAction(input: SaveTableInput) {
    try {
        const profile = await requireRestaurantRole(['admin', 'owner']);
        const targetRestaurantId = profile.is_super_admin ? input.restaurantId : profile.restaurant_id!;

        if (!targetRestaurantId) {
            return { success: false, error: 'Restaurant ID is required' };
        }

        const trimmedNumber = input.number.trim();
        if (!trimmedNumber) {
            return { success: false, error: 'Table number or name is required' };
        }

        const capacity = Number(input.capacity) || 2;
        if (capacity < 1) {
            return { success: false, error: 'Capacity must be at least 1' };
        }

        // Check for duplicate table number within the same restaurant
        const supabase = await createClient();
        const { data: existingTables, error: checkError } = await (supabase
            .from('tables') as any)
            .select('id, number')
            .eq('restaurant_id', targetRestaurantId)
            .ilike('number', trimmedNumber);

        if (!checkError && existingTables && existingTables.length > 0) {
            const isDuplicate = existingTables.some((t: any) => t.id !== input.id);
            if (isDuplicate) {
                return { success: false, error: 'DUPLICATE_NUMBER' };
            }
        }

        const tablePayload = {
            restaurant_id: targetRestaurantId,
            number: trimmedNumber,
            capacity,
            waitress_id: input.waitress_id ? input.waitress_id : null
        };

        if (input.id) {
            // Update table
            const { data, error } = await (supabaseAdmin
                .from('tables') as any)
                .update(tablePayload)
                .eq('id', input.id)
                .eq('restaurant_id', targetRestaurantId)
                .select()
                .single();

            if (error) throw error;
            revalidatePath('/[locale]/admin/tables', 'page');
            return { success: true, table: data };
        } else {
            // Insert table
            const { data, error } = await (supabaseAdmin
                .from('tables') as any)
                .insert([tablePayload])
                .select()
                .single();

            if (error) throw error;
            revalidatePath('/[locale]/admin/tables', 'page');
            return { success: true, table: data };
        }
    } catch (err: any) {
        console.error('saveTableAction Error:', err);
        return { success: false, error: err.message || 'Error saving table' };
    }
}

export async function deleteTableAction(tableId: string, restaurantId: string) {
    try {
        const profile = await requireRestaurantRole(['admin', 'owner']);
        const targetRestaurantId = profile.is_super_admin ? restaurantId : profile.restaurant_id!;

        if (!tableId || !tableId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            return { success: false, error: 'Invalid table ID format' };
        }

        // 1. Verify table belongs to this restaurant
        const supabase = await createClient();
        const { data: table, error: findError } = await (supabase
            .from('tables') as any)
            .select('id, restaurant_id')
            .eq('id', tableId)
            .single();

        if (findError || !table) {
            return { success: false, error: 'Table not found' };
        }

        if (table.restaurant_id !== targetRestaurantId && !profile.is_super_admin) {
            return { success: false, error: 'Unauthorized table access' };
        }

        // 2. Unlink any orders referencing this table before deleting to prevent foreign key violation (23503)
        const { error: unlinkError } = await (supabaseAdmin
            .from('orders') as any)
            .update({ table_id: null })
            .eq('table_id', tableId);

        if (unlinkError) {
            console.error('Error unlinking table_id from orders:', unlinkError);
            return { success: false, error: `Error unlinking orders: ${unlinkError.message}` };
        }

        // 3. Delete the table record
        const { error: deleteError } = await (supabaseAdmin
            .from('tables') as any)
            .delete()
            .eq('id', tableId)
            .eq('restaurant_id', targetRestaurantId);

        if (deleteError) {
            console.error('Error deleting table from database:', deleteError);
            return { success: false, error: deleteError.message };
        }

        revalidatePath('/[locale]/admin/tables', 'page');
        return { success: true };
    } catch (err: any) {
        console.error('deleteTableAction Error:', err);
        return { success: false, error: err.message || 'Error deleting table' };
    }
}
