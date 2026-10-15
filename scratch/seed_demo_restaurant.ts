import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

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
    console.warn(e);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
    const restaurantId = '0dabef13-28dc-42a1-9fa7-355eeab6b5d1';

    console.log('--- Sembrando datos iniciales en Demo restaurant test ---');

    // 1. Sembrar mesas
    const tablesToInsert = [
        { restaurant_id: restaurantId, number: '1', capacity: 4 },
        { restaurant_id: restaurantId, number: '2', capacity: 4 },
        { restaurant_id: restaurantId, number: '3', capacity: 2 },
        { restaurant_id: restaurantId, number: '4', capacity: 4 },
        { restaurant_id: restaurantId, number: '5', capacity: 6 },
        { restaurant_id: restaurantId, number: '6', capacity: 4 },
    ];

    const { data: insertedTables, error: tablesErr } = await supabase
        .from('tables')
        .insert(tablesToInsert)
        .select();

    if (tablesErr) {
        console.error('Error sembrando mesas:', tablesErr);
    } else {
        console.log(`Sembradas ${insertedTables.length} mesas exitosamente.`);
    }

    // 2. Sembrar categorías
    const categoriesToInsert = [
        { restaurant_id: restaurantId, name: 'Platos Principales', sort_order: 1 },
        { restaurant_id: restaurantId, name: 'Bebidas', sort_order: 2 },
        { restaurant_id: restaurantId, name: 'Postres', sort_order: 3 },
    ];

    const { data: insertedCats, error: catErr } = await supabase
        .from('categories')
        .insert(categoriesToInsert)
        .select();

    if (catErr) {
        console.error('Error sembrando categorías:', catErr);
    } else {
        console.log(`Sembradas ${insertedCats.length} categorías exitosamente.`);
    }
}

main().catch(console.error);
