'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/lib/auth/guards';

export interface SystemSetting {
    key: string;
    value: string;
    description?: string;
    updated_at?: string;
}

/**
 * Super Admin: Retrieves all settings.
 */
export async function getSystemSettings(): Promise<SystemSetting[]> {
    try {
        await requireSuperAdmin();
        const supabase = await createClient();

        const { data, error } = await (supabase
            .from('system_settings' as any) as any)
            .select('key, value, description, updated_at')
            .order('key');

        if (error) {
            // If table doesn't exist yet, return empty array defensively
            if (error.message.includes('relation') || error.message.includes('does not exist')) {
                console.warn('⚠️ Table system_settings does not exist. Run migration.');
                return [];
            }
            throw new Error(error.message);
        }

        return data || [];
    } catch (err: any) {
        console.error('getSystemSettings error:', err);
        return [];
    }
}

/**
 * Super Admin: Updates or inserts a system setting.
 */
export async function updateSystemSetting(key: string, value: string, description?: string) {
    try {
        await requireSuperAdmin();
        const supabase = await createClient();

        const { error } = await (supabase
            .from('system_settings' as any) as any)
            .upsert({
                key,
                value,
                description,
                updated_at: new Date().toISOString()
            });

        if (error) {
            throw new Error(`Error al actualizar configuración: ${error.message}. ¿Ejecutó la migración SQL?`);
        }

        revalidatePath('/super-admin/settings');
        return { success: true };
    } catch (err: any) {
        console.error('updateSystemSetting error:', err);
        return { success: false, error: err.message || 'Error al guardar la configuración' };
    }
}
