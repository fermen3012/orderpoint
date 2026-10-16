'use server';

import { getAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/lib/auth/guards';

export interface SystemSetting {
    key: string;
    value: string;
    description?: string;
    updated_at?: string;
}

const SENSITIVE_KEYS = ['stripe_secret_key', 'stripe_webhook_secret', 'gemini_api_key'];

function maskSecretValue(val: string): string {
    if (!val) return '';
    if (val.length <= 10) return '••••••••••••';
    const prefixMatch = val.match(/^(sk_live_|sk_test_|whsec_|rk_live_|rk_test_)/);
    const prefix = prefixMatch ? prefixMatch[0] : val.slice(0, 4);
    const suffix = val.slice(-4);
    return `${prefix}••••••••••••${suffix}`;
}

/**
 * Super Admin: Retrieves all settings (with secret keys masked for client safety).
 */
export async function getSystemSettings(): Promise<SystemSetting[]> {
    try {
        await requireSuperAdmin();
        const supabase = getAdminClient();

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

        return (data || []).map((item: SystemSetting) => ({
            ...item,
            value: SENSITIVE_KEYS.includes(item.key) ? maskSecretValue(item.value) : item.value,
        }));
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

        if (!key || typeof key !== 'string') {
            throw new Error('Clave de configuración inválida');
        }

        // Si es una llave sensible y viene enmascarada (el usuario no escribió una llave nueva), conservar el valor actual en BD
        if (SENSITIVE_KEYS.includes(key) && value.includes('••••')) {
            return { success: true };
        }

        const supabase = getAdminClient();

        const { error } = await (supabase
            .from('system_settings' as any) as any)
            .upsert({
                key: key.trim(),
                value: value.trim(),
                description,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

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
