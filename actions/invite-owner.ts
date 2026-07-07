'use server'

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/supabase/types';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { headers } from 'next/headers';

export async function inviteRestaurantOwner(email: string, restaurantId: string, locale: string) {
    try {
        // Enforce super admin authorization
        await requireSuperAdmin();

        // Input validation
        if (!email || !email.includes('@')) {
            return { error: 'Correo electrónico inválido' };
        }
        if (!restaurantId || !restaurantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            return { error: 'ID de restaurante inválido' };
        }
        if (!['es', 'en'].includes(locale)) {
            locale = 'es';
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        // Dynamically resolve the site URL based on request headers
        const headersList = await headers();
        const host = headersList.get('host') || 'localhost:3000';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const siteUrl = `${protocol}://${host}`;

        if (!supabaseUrl || !supabaseServiceKey) {
            return { error: 'Missing environment variables' };
        }

        // Usamos el service role key para tener privilegios de admin (instantiated after auth check)
        const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

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

        // next-intl default locale is 'es', which hides the locale prefix.
        // We use the canonical path to avoid next-intl redirects that can drop hash parameters.
        const redirectPath = locale === 'es' ? '/set-password' : `/${locale}/set-password`;
        const redirectToUrl = `${siteUrl}${redirectPath}`;

        // 2. Enviar invitación
        const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: {
                role: 'owner',
                restaurant_id: restaurantId
            },
            redirectTo: redirectToUrl,
        });

        if (error) {
            console.error('Error inviting user:', error.message);
            return { error: error.message };
        }

        return { success: true };
    } catch (err: any) {
        console.error('Unexpected error:', err);
        return { error: err.message || 'Ocurrió un error inesperado al enviar la invitación' };
    }
}
