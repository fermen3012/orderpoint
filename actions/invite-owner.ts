'use server'

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/supabase/types';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { headers } from 'next/headers';
import crypto from 'crypto';

interface SignedInvitePayload {
    uid: string;
    email: string;
    rid: string;
    exp: number;
}

function createSignedInviteToken(payload: SignedInvitePayload, secret: string): string {
    const dataB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sigB64 = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');
    return `${dataB64}.${sigB64}`;
}

function verifySignedInviteToken(token: string, secret: string): SignedInvitePayload | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 2) return null;
        const [dataB64, sigB64] = parts;
        const expectedSig = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');
        if (sigB64.length !== expectedSig.length) return null;
        if (!crypto.timingSafeEqual(Buffer.from(sigB64), Buffer.from(expectedSig))) return null;
        const payload = JSON.parse(Buffer.from(dataB64, 'base64url').toString('utf8')) as SignedInvitePayload;
        if (!payload.uid || !payload.email || !payload.rid || !payload.exp) return null;
        if (Date.now() > payload.exp) return null;
        return payload;
    } catch {
        return null;
    }
}

function getServiceAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase environment variables');
    }
    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
    return { supabaseAdmin, supabaseServiceKey };
}

export async function inviteRestaurantOwner(email: string, restaurantId: string, locale: string) {
    try {
        // Enforce super admin authorization
        await requireSuperAdmin();

        const cleanEmail = (email || '').trim().toLowerCase();

        // Input validation
        if (!cleanEmail || !cleanEmail.includes('@')) {
            return { error: 'Correo electrónico inválido' };
        }
        if (!restaurantId || !restaurantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            return { error: 'ID de restaurante inválido' };
        }
        if (!['es', 'en'].includes(locale)) {
            locale = 'es';
        }

        // Prioritize NEXT_PUBLIC_APP_URL to prevent Host Header Injection, with validated fallback
        let siteUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
        if (!siteUrl) {
            const headersList = await headers();
            const rawHost = headersList.get('host') || 'localhost:3000';
            const safeHost = /^[a-zA-Z0-9.-]+(:[0-9]+)?$/.test(rawHost) ? rawHost : 'localhost:3000';
            const protocol = safeHost.includes('localhost') ? 'http' : 'https';
            siteUrl = `${protocol}://${safeHost}`;
        }

        const { supabaseAdmin, supabaseServiceKey } = getServiceAdminClient();

        // 0. Verificar que el restaurante destino exista y obtener su nombre real
        const { data: targetRestaurant, error: restError } = await (supabaseAdmin
            .from('restaurants' as any) as any)
            .select('id, name')
            .eq('id', restaurantId)
            .maybeSingle();

        if (restError || !targetRestaurant) {
            return { error: 'El restaurante seleccionado no existe.' };
        }

        // 1. Verificar si el usuario ya existe
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;

        const existingUser = users.find(u => u.email?.toLowerCase() === cleanEmail);

        if (existingUser) {
            // Verificar si el usuario ya completó su registro (nombre y términos aceptados en profiles)
            const { data: existingProfile } = await (supabaseAdmin
                .from('profiles' as any) as any)
                .select('full_name, terms_accepted, restaurant_id')
                .eq('id', existingUser.id)
                .maybeSingle();

            const existingRestId = existingProfile?.restaurant_id || existingUser.user_metadata?.restaurant_id;
            let existingRestName = 'otro restaurante';
            if (existingRestId) {
                const { data: exRest } = await (supabaseAdmin
                    .from('restaurants' as any) as any)
                    .select('name')
                    .eq('id', existingRestId)
                    .maybeSingle();
                if (exRest?.name) existingRestName = exRest.name;
            }

            const hasCompletedOnboarding = Boolean(
                existingProfile?.terms_accepted || (existingUser.last_sign_in_at && existingProfile?.full_name)
            );

            if (hasCompletedOnboarding) {
                return {
                    error: `Este correo ya está registrado y activo en "${existingRestName}". Por favor usa un correo diferente.`
                };
            }

            // Guardia Multi-Tenant: evitar que al abrir por error otro restaurante se sobreescriba una invitación pendiente de un restaurante distinto
            if (existingRestId && existingRestId !== restaurantId) {
                return {
                    error: `Este correo ya tiene una invitación pendiente para el restaurante "${existingRestName}". Abre la opción "Invitar Dueño" de "${existingRestName}" para obtener su enlace, o elimina primero la invitación pendiente en Usuarios.`
                };
            }

            // Si es una invitación pendiente para ESTE MISMO restaurante, limpiamos para emitir enlace y correo nuevo
            await (supabaseAdmin.from('profiles' as any) as any).delete().eq('id', existingUser.id);
            await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
        }

        // Usar siempre la ruta con locale explícito (/es/set-password o /en/set-password) y restaurant_id explícito
        const redirectPath = `/${locale}/set-password`;
        const redirectToUrl = `${siteUrl}${redirectPath}`;
        const emailRedirectUrl = `${redirectToUrl}?restaurant_id=${encodeURIComponent(restaurantId)}`;

        // 2. Intentar enviar el correo oficial con inviteUserByEmail PRIMERO (sin llamar después a generateLink para no invalidar el token del correo)
        let userId: string | null = null;
        let emailSent = false;

        const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
            cleanEmail,
            {
                data: {
                    role: 'owner',
                    restaurant_id: restaurantId,
                    restaurant_name: targetRestaurant.name
                },
                redirectTo: emailRedirectUrl
            }
        );

        if (!inviteError && inviteData?.user?.id) {
            userId = inviteData.user.id;
            emailSent = true;
        } else {
            console.warn('inviteUserByEmail warning (usando respaldo generateLink):', inviteError?.message);
            const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
                type: 'invite',
                email: cleanEmail,
                options: {
                    data: {
                        role: 'owner',
                        restaurant_id: restaurantId,
                        restaurant_name: targetRestaurant.name
                    },
                    redirectTo: emailRedirectUrl
                }
            });

            if (linkError || !linkData?.user?.id) {
                console.error('Error generating invite link:', linkError?.message);
                return { error: linkError?.message || 'No se pudo generar la invitación' };
            }
            userId = linkData.user.id;
            emailSent = false;
        }

        // 3. Asegurar que exista el perfil inicial vinculado estrictamente al restaurante destino
        await (supabaseAdmin.from('profiles' as any) as any).upsert({
            id: userId,
            restaurant_id: restaurantId,
            role: 'owner',
            is_super_admin: false,
            terms_accepted: false
        });

        // 4. Generar enlace directo firmado con HMAC-SHA256 (no invalida el token del correo ni se consume por la vista previa de WhatsApp)
        const signedToken = createSignedInviteToken(
            {
                uid: userId,
                email: cleanEmail,
                rid: restaurantId,
                exp: Date.now() + 24 * 60 * 60 * 1000
            },
            supabaseServiceKey
        );

        const inviteLink = `${redirectToUrl}?invite_token=${encodeURIComponent(signedToken)}&restaurant_id=${encodeURIComponent(restaurantId)}`;

        return {
            success: true,
            inviteLink,
            emailSent,
            restaurantName: targetRestaurant.name
        };
    } catch (err: any) {
        console.error('Unexpected error:', err);
        return { error: err.message || 'Ocurrió un error inesperado al enviar la invitación' };
    }
}

export async function verifyOwnerInviteContext(params: {
    inviteToken?: string | null;
    userId?: string | null;
    urlRestaurantId?: string | null;
}) {
    try {
        const { supabaseAdmin, supabaseServiceKey } = getServiceAdminClient();

        if (params.inviteToken) {
            const payload = verifySignedInviteToken(params.inviteToken, supabaseServiceKey);
            if (!payload) {
                return { valid: false, error: 'El enlace de invitación ha expirado o no es válido. Solicita un enlace nuevo al administrador.' };
            }

            if (params.urlRestaurantId && params.urlRestaurantId !== payload.rid) {
                return { valid: false, error: 'El identificador del restaurante en el enlace no coincide con la invitación.' };
            }

            const [{ data: userData, error: userErr }, { data: profile }, { data: restaurant }] = await Promise.all([
                supabaseAdmin.auth.admin.getUserById(payload.uid),
                (supabaseAdmin.from('profiles' as any) as any).select('*').eq('id', payload.uid).maybeSingle(),
                (supabaseAdmin.from('restaurants' as any) as any).select('id, name').eq('id', payload.rid).maybeSingle()
            ]);

            if (userErr || !userData?.user) {
                return { valid: false, error: 'Esta invitación fue reemplazada por una más reciente. Solicita el último enlace generado.' };
            }

            if (profile?.terms_accepted) {
                return { valid: false, error: 'Esta invitación ya fue completada anteriormente. Puedes iniciar sesión con tu correo y contraseña.' };
            }

            if (!restaurant) {
                return { valid: false, error: 'El restaurante asociado a esta invitación ya no existe.' };
            }

            return {
                valid: true,
                userId: payload.uid,
                email: userData.user.email || payload.email,
                restaurantId: payload.rid,
                restaurantName: restaurant.name
            };
        }

        if (params.userId) {
            const [{ data: userData, error: userErr }, { data: profile }] = await Promise.all([
                supabaseAdmin.auth.admin.getUserById(params.userId),
                (supabaseAdmin.from('profiles' as any) as any).select('*').eq('id', params.userId).maybeSingle()
            ]);

            if (userErr || !userData?.user) {
                return { valid: false, error: 'No se encontró el usuario de la invitación.' };
            }

            if (profile?.terms_accepted) {
                return { valid: false, error: 'Esta cuenta ya está activa en el sistema. Por favor inicia sesión normalmente.' };
            }

            const userMetaRestId = userData.user.user_metadata?.restaurant_id;
            const profileRestId = profile?.restaurant_id;

            if (params.urlRestaurantId && userMetaRestId && params.urlRestaurantId !== userMetaRestId) {
                return { valid: false, error: 'La sesión detectada pertenece a otro restaurante. Abre de nuevo el enlace de invitación.' };
            }

            const targetRestId = params.urlRestaurantId || userMetaRestId || profileRestId;
            if (!targetRestId) {
                return { valid: false, error: 'Esta invitación no tiene un restaurante asignado.' };
            }

            const { data: restaurant } = await (supabaseAdmin
                .from('restaurants' as any) as any)
                .select('id, name')
                .eq('id', targetRestId)
                .maybeSingle();

            return {
                valid: true,
                userId: userData.user.id,
                email: userData.user.email || '',
                restaurantId: targetRestId,
                restaurantName: restaurant?.name || 'Restaurante'
            };
        }

        return { valid: false, error: 'No se proporcionó un token o sesión de invitación válida.' };
    } catch (err: any) {
        console.error('verifyOwnerInviteContext error:', err);
        return { valid: false, error: err.message || 'Error al verificar la invitación' };
    }
}

export async function completeOwnerOnboarding(params: {
    inviteToken?: string | null;
    userId?: string | null;
    restaurantId?: string | null;
    fullName: string;
    password: string;
}) {
    try {
        const cleanName = (params.fullName || '').trim();
        if (!cleanName) {
            return { error: 'El nombre completo es obligatorio.' };
        }
        if (!params.password || params.password.length < 6) {
            return { error: 'La contraseña debe tener al menos 6 caracteres.' };
        }

        const verification = await verifyOwnerInviteContext({
            inviteToken: params.inviteToken,
            userId: params.userId,
            urlRestaurantId: params.restaurantId
        });

        if (!verification.valid || !verification.userId || !verification.restaurantId) {
            return { error: verification.error || 'Invitación no válida.' };
        }

        const { supabaseAdmin } = getServiceAdminClient();

        // 1. Actualizar contraseña, confirmar email y fijar estrictamente el restaurant_id en Auth
        const { error: updateAuthErr } = await supabaseAdmin.auth.admin.updateUserById(
            verification.userId,
            {
                password: params.password,
                email_confirm: true,
                user_metadata: {
                    role: 'owner',
                    restaurant_id: verification.restaurantId,
                    restaurant_name: verification.restaurantName,
                    full_name: cleanName,
                    email_verified: true
                }
            }
        );

        if (updateAuthErr) {
            return { error: updateAuthErr.message };
        }

        // 2. Actualizar el perfil público fijando estrictamente el restaurant_id verificado
        const { error: profileErr } = await (supabaseAdmin
            .from('profiles' as any) as any)
            .upsert({
                id: verification.userId,
                restaurant_id: verification.restaurantId,
                role: 'owner',
                full_name: cleanName,
                is_super_admin: false,
                terms_accepted: true,
                terms_accepted_at: new Date().toISOString(),
                terms_version: 'v2.0-FL'
            });

        if (profileErr) {
            return { error: profileErr.message };
        }

        return {
            success: true,
            email: verification.email,
            restaurantId: verification.restaurantId,
            restaurantName: verification.restaurantName
        };
    } catch (err: any) {
        console.error('completeOwnerOnboarding error:', err);
        return { error: err.message || 'Error al activar la cuenta de propietario' };
    }
}

