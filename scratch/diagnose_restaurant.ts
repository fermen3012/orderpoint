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

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
    const restaurantId = '0dabef13-28dc-42a1-9fa7-355eeab6b5d1'; // Demo restaurant test
    console.log('=== AUDITORÍA DEL RESTAURANTE NUEVO: Demo restaurant test ===');

    // 1. Datos básicos
    const { data: rest } = await supabase.from('restaurants').select('*').eq('id', restaurantId).single();
    console.log('Restaurante:', rest);

    // 2. Mesas
    const { data: tables } = await supabase.from('tables').select('*').eq('restaurant_id', restaurantId);
    console.log('Mesas configuradas:', tables?.length || 0);

    // 3. Categorías
    const { data: categories } = await supabase.from('categories').select('*').eq('restaurant_id', restaurantId);
    console.log('Categorías de menú:', categories?.length || 0);

    // 4. Productos
    const { data: products } = await supabase.from('products').select('*').eq('restaurant_id', restaurantId);
    console.log('Productos de menú:', products?.length || 0);

    // 5. Impresoras / Printer settings
    const { data: printers } = await supabase.from('printer_settings').select('*').eq('restaurant_id', restaurantId);
    console.log('Configuraciones de impresora:', printers?.length || 0);

    // 6. Profiles / Staff asociados
    const { data: profiles } = await supabase.from('profiles').select('*').eq('restaurant_id', restaurantId);
    console.log('Personal / Dueño asignado:', profiles?.length || 0);

    // 7. Plan en system_settings
    const { data: settings } = await supabase.from('system_settings').select('value').eq('key', 'restaurant_plans_map').single();
    const map = settings?.value ? JSON.parse(settings.value) : {};
    console.log('Plan asignado en mapa:', map[restaurantId]);
}

main().catch(console.error);
