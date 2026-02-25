const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const logFile = 'test_results.log';
function log(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}\n`;
    console.log(msg);
    fs.appendFileSync(logFile, line);
}

if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

const content = fs.readFileSync('.env.local', 'utf8');
const env = {};
content.split(/\r?\n/).forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const restaurantId = '550e8400-e29b-41d4-a716-446655440000';

async function runTest() {
    log('--- KDS RESILIENCE TEST v3 ---');

    let ordersCount = 0;

    async function loadOrders() {
        const { data, error } = await supabase.from('orders').select('id').eq('restaurant_id', restaurantId).neq('status', 'completed');
        if (error) log(`Load Error: ${error.message}`);
        if (data) {
            ordersCount = data.length;
            log(`[SYNC] Orders re-fetched. Current Count: ${ordersCount}`);
        }
    }

    const channel = supabase
        .channel('kitchen-orders')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
            (payload) => {
                log(`>>> [EVENT] New order received! ID: ${payload.new.id}`);
                loadOrders();
            }
        )
        .subscribe(async (status) => {
            log(`Channel status changed: ${status}`);
            if (status === 'SUBSCRIBED') {
                log('Channel is SUBSCRIBED/RECONNECTED. Syncing...');
                await loadOrders();
            }
        });

    await new Promise(resolve => setTimeout(resolve, 5000));
    const initialCount = ordersCount;
    log(`Initial orders count: ${initialCount}`);

    log('Simulating Network Offline...');
    supabase.realtime.disconnect();

    log('Waiting 5s while offline...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const externalClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    log('Inserting test order via Kiosk simulation...');
    const { data: newOrder, error: insError } = await externalClient.from('orders').insert({
        restaurant_id: restaurantId,
        order_number: 999,
        status: 'pending',
        total_amount: 1.00,
        order_type: 'dine_in'
    }).select().single();

    if (insError) {
        log(`Insert Error: ${insError.message}`);
        process.exit(1);
    }
    log(`Order inserted: ${newOrder.id}`);

    log('Waiting 10s more while offline...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    log('Restoring Network...');
    supabase.realtime.connect();

    log('Waiting for re-sync event (15s)...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    if (ordersCount > initialCount) {
        log(`[RESULT] SUCCESS: Orders count increased from ${initialCount} to ${ordersCount} automatically.`);
    } else {
        log(`[RESULT] FAILURE: Orders count remained ${ordersCount}. Sync did not catch the new order.`);
    }

    if (newOrder) {
        await externalClient.from('orders').delete().eq('id', newOrder.id);
        log('Cleanup done.');
    }

    log('--- TEST END ---');
    process.exit(0);
}

runTest();
