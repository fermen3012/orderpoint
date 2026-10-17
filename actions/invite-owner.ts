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
        
        // Prioritize NEXT_PUBLIC_APP_URL to prevent Host Header Injection, with validated fallback
        let siteUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
        if (!siteUrl) {
            const headersList = await headers();
            const rawHost = headersList.get('host') || 'localhost:3000';
            const safeHost = /^[a-zA-Z0-9.-]+(:[0-9]+)?$/.test(rawHost) ? rawHost : 'localhost:3000';
            const protocol = safeHost.includes('localhost') ? 'http' : 'https';
            siteUrl = `${protocol}://${safeHost}`;
        }

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
            // Verificar si el usuario ya completó su registro (nombre y términos aceptados en profiles)
            const { data: existingProfile } = await (supabaseAdmin
                .from('profiles' as any) as any)
                .select('full_name, terms_accepted')
                .eq('id', existingUser.id)
                .maybeSingle();

            const hasCompletedOnboarding = Boolean(
                existingProfile?.terms_accepted || (existingUser.last_sign_in_at && existingProfile?.full_name)
            );

            if (hasCompletedOnboarding) {
                return { error: 'Este usuario ya está registrado y activo en el sistema.' };
            }

            // Si es una invitación pendiente o incompleta (nunca configuró contraseña/términos), limpiamos para emitir enlace nuevo
            await (supabaseAdmin.from('profiles' as any) as any).delete().eq('id', existingUser.id);
            await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
        }

        // Usar siempre la ruta con locale explícito (/es/set-password o /en/set-password) para evitar 404
        const redirectPath = `/${locale}/set-password`;
        const redirectToUrl = `${siteUrl}${redirectPath}`;

        // 2. Generar el enlace único de invitación sin sobreescribir el token con una segunda llamada
        let inviteLink: string | null = null;
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'invite',
            email,
            options: {
                data: {
                    role: 'owner',
                    restaurant_id: restaurantId
                },
                redirectTo: redirectToUrl
            }
        });

        if (linkError) {
            console.error('Error generating invite link:', linkError.message);
            return { error: linkError.message };
        }

        // Asegurar que exista el perfil inicial vinculado al restaurante
        if (linkData?.user?.id) {
            await (supabaseAdmin.from('profiles' as any) as any).upsert({
                id: linkData.user.id,
                restaurant_id: restaurantId,
                role: 'owner',
                is_super_admin: false,
                terms_accepted: false
            });
        }

        if (linkData?.properties?.hashed_token) {
            // Enlace directo a la aplicación que verifica el token_hash en el cliente sin depender de redirecciones externas
            inviteLink = `${redirectToUrl}?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}&type=invite`;
        } else if (linkData?.properties?.action_link) {
            inviteLink = linkData.properties.action_link;
        }

        if (!inviteLink) {
            return { error: 'No se pudo generar el enlace de invitación. Verifica las credenciales de Supabase.' };
        }

        return {
            success: true,
            inviteLink,
            emailSent: false
        };
    } catch (err: any) {
        console.error('Unexpected error:', err);
        return { error: err.message || 'Ocurrió un error inesperado al enviar la invitación' };
    }
}
