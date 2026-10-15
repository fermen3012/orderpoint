import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
let supabaseUrl = '';
let supabaseServiceKey = '';

try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        envContent.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx !== -1) {
                    const key = trimmed.slice(0, eqIdx).trim();
                    let val = trimmed.slice(eqIdx + 1).trim();
                    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                        val = val.slice(1, -1);
                    }
                    if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = val;
                    if (key === 'SUPABASE_SERVICE_ROLE_KEY') supabaseServiceKey = val;
                }
            }
        });
    }
} catch (e) {
    console.warn('Could not read .env.local:', e);
}

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
    console.log('--- Creando restaurante "Demo restaurant test" ---');

    const name = 'Demo restaurant test';
    const slug = 'demo-restaurant-test';
    const planId = 'plan_exo_salon';

    // 1. Verificar si ya existe
    const { data: existing, error: existErr } = await supabase
        .from('restaurants')
        .select('*')
        .eq('slug', slug);

    if (existErr) {
        console.error('Error buscando si existe:', existErr);
        process.exit(1);
    }

    let restaurantId = null;

    if (existing && existing.length > 0) {
        console.log('Restaurante ya existía con ID:', existing[0].id);
        restaurantId = existing[0].id;
    } else {
        // 2. Insertar nuevo restaurante
        const { data: newRest, error: insertErr } = await supabase
            .from('restaurants')
            .insert({
                name,
                slug,
                is_active: true,
                unit_price: 99,
                subscription_status: 'active',
                plan_quantity: 1,
            })
            .select()
            .single();

        if (insertErr) {
            console.error('Error al insertar restaurante:', insertErr);
            process.exit(1);
        }

        restaurantId = newRest.id;
        console.log('Restaurante insertado exitosamente con ID:', restaurantId);
    }

    // 3. Asociar plan_id en system_settings (restaurant_plans_map)
    const { data: settingsData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'restaurant_plans_map')
        .single();

    let map: Record<string, string> = {};
    if (settingsData?.value) {
        try {
            map = JSON.parse(settingsData.value);
        } catch {}
    }
    map[restaurantId] = planId;

    await supabase
        .from('system_settings')
        .upsert({
            key: 'restaurant_plans_map',
            value: JSON.stringify(map),
            description: 'Mapeo de planes SaaS asignados a cada restaurante',
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

    console.log('Plan asignado correctamente en system_settings:', planId);

    // 4. Intentar actualizar columna plan_id si existe
    try {
        await supabase
            .from('restaurants')
            .update({ plan_id: planId })
            .eq('id', restaurantId);
    } catch {}

    // 5. Verificar integridad del restaurante en BD
    const { data: verified, error: verifyErr } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single();

    if (verifyErr || !verified) {
        console.error('Error al verificar restaurante:', verifyErr);
        process.exit(1);
    }

    console.log('--- Verificación exitosa en Supabase ---');
    console.log('ID:', verified.id);
    console.log('Nombre:', verified.name);
    console.log('Slug:', verified.slug);
    console.log('Activo:', verified.is_active);
    console.log('Unit Price:', verified.unit_price);
    console.log('Subscription Status:', verified.subscription_status);
    console.log('Created At:', verified.created_at);

    // 6. Verificar total actual de restaurantes
    const { count } = await supabase
        .from('restaurants')
        .select('*', { count: 'exact', head: true });

    console.log('Total restaurantes registrados ahora en OrderPoint:', count);
}

main().catch(err => {
    console.error('Error en ejecución:', err);
    process.exit(1);
});
