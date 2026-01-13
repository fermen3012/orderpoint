'use server'

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/supabase/types';

export async function inviteRestaurantOwner(email: string, restaurantId: string, locale: string) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://192.168.4.28:3000';

    if (!supabaseUrl || !supabaseServiceKey) {
        return { error: 'Missing environment variables' };
    }

    // Usamos el service role key para tener privilegios de admin
    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        // 1. Verificar si el usuario ya existe
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;

        const existingUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

        if (existingUser) {
            // Si el usuario ya inició sesión alguna vez, no lo borramos por seguridad
            if (existingUser.last_sign_in_at) {
                return { error: 'Este usuario ya está registrado y activo en el sistema.' };
            }

            // Si es una invitación pendiente (nunca hizo login), lo borramos para poder re-enviarla
            await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
        }

        // 2. Enviar invitación
        const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: {
                role: 'owner',
                restaurant_id: restaurantId
            },
            redirectTo: `${siteUrl}/${locale}/set-password`,
        });

        if (error) {
            console.error('Error inviting user:', error.message);
            return { error: error.message };
        }

        return { success: true, data };
    } catch (err) {
        console.error('Unexpected error:', err);
        return { error: 'Ocurrió un error inesperado al enviar la invitación' };
    }
}
