const http = require('http');
const crypto = require('crypto');

// ==========================================
// CONFIGURACIÓN DE PRUEBA
// ==========================================
// Este ID debe coincidir con un restaurante real en tu base de datos Supabase
// Copia el ID de la URL o de la tabla 'restaurants' y pégalo aquí:
const RESTAURANT_ID = '14b1af53-7436-43c3-b96d-59c1199904f3'; // <--- CAMBIA ESTO POR UN ID REAL

const WEBHOOK_SECRET = 'whsec_local_test_123'; // Debe coincidir con .env.local
const PORT = 3000;
// ==========================================

const payload = {
    id: 'evt_test_webhook_' + Date.now(),
    object: 'event',
    api_version: '2025-01-27.acacia',
    created: Math.floor(Date.now() / 1000),
    type: 'checkout.session.completed',
    data: {
        object: {
            id: 'cs_test_session_' + Date.now(),
            object: 'checkout.session',
            amount_total: 2900,
            currency: 'usd',
            client_reference_id: RESTAURANT_ID, // Esto le dice a tu API qué restaurante activar
            customer: 'cus_test_' + Date.now(),
            payment_status: 'paid',
            status: 'complete',
            mode: 'payment',
            subscription: null, // Cambiar a 'sub_...' si pruebas lógica de suscripción
            metadata: {}
        }
    }
};

const payloadString = JSON.stringify(payload);
const timestamp = Math.floor(Date.now() / 1000);

// Generar firma HMAC-SHA256 válida
const signature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(`${timestamp}.${payloadString}`)
    .digest('hex');

const options = {
    hostname: 'localhost',
    port: PORT,
    path: '/api/webhooks/stripe',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': `t=${timestamp},v1=${signature}`,
        'Content-Length': payloadString.length,
    },
};

console.log('📡 Enviando Webhook de prueba a http://localhost:3000/api/webhooks/stripe...');
console.log('🔑 Restaurant ID:', RESTAURANT_ID);
console.log('📝 Payload Size:', payloadString.length);

const req = http.request(options, (res) => {
    console.log(`\n📨 Respuesta del Servidor: STATUS ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`📦 Body: ${chunk}`);
    });

    if (res.statusCode === 200) {
        console.log('\n✅ ¡ÉXITO! El servidor procesó el webhook correctamente.');
        console.log('   Verifica en Supabase que el restaurante ahora tenga status "active".');
    } else {
        console.log('\n❌ ERROR: Algo salió mal. Revisa los logs de la terminal donde corre Next.js.');
    }
});

req.on('error', (e) => {
    console.error(`\n❌ Error de conexión: ${e.message}`);
    console.log('   Asegúrate de que tu servidor Next.js esté corriendo en el puerto 3000.');
});

req.write(payloadString);
req.end();
