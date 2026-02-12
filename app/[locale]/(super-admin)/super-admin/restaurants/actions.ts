'use server';

import { getAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getRestaurants() {
    const supabase = getAdminClient();
    const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        return { error: error.message };
    }

    return { data };
}

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

export async function uploadRestaurantLogo(formData: FormData) {
    const file = formData.get('file') as File;
    const restaurantId = formData.get('restaurantId') as string;

    if (!file || !restaurantId) {
        return { error: 'Faltan datos (archivo o ID)' };
    }

    try {
        const supabase = getAdminClient();
        const fileName = `logos/${restaurantId}-${Date.now()}.png`;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error: uploadError } = await supabase.storage
            .from('restaurants')
            .upload(fileName, buffer, {
                contentType: 'image/png',
                upsert: true
            });

        if (uploadError) {
            console.error('Upload Error:', uploadError);
            return { error: 'Error al subir imagen: ' + uploadError.message };
        }

        const { data: { publicUrl } } = supabase.storage
            .from('restaurants')
            .getPublicUrl(fileName);

        const { error: dbError } = await supabase
            .from('restaurants')
            .update({ logo_url: publicUrl })
            .eq('id', restaurantId);

        if (dbError) {
            return { error: 'Error al actualizar base de datos: ' + dbError.message };
        }

        revalidatePath('/[locale]/super-admin/restaurants');
        return { success: true, url: publicUrl };
    } catch (err: any) {
        console.error('Server Action Error:', err);
        return { error: 'Error inesperado: ' + err.message };
    }
}
