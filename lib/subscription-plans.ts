export interface SubscriptionPlan {
    id: string; // Identificador único / slug
    name: string; // Nombre del plan (ej. Módulo Salón & Cocina Exo Server)
    description: string;
    monthly_price: number; // Precio mensual en USD
    setup_fee: number; // Costo único de instalación / hardware en USD
    annual_price?: number; // Precio anual con descuento (opcional)
    stripe_product_id?: string;
    stripe_price_id?: string;
    modules: {
        kiosk: boolean; // Kiosko de autoservicio táctil
        kds: boolean; // Pantalla de cocina en tiempo real
        waitress_exo: boolean; // Comandeo móvil para meseros
        qr_menu: boolean; // Menú digital QR para mesas
    };
    max_screens: number; // 0 = ilimitado (BYOD), 1, 2, etc.
    extra_screen_price: number; // Tarifa por pantalla extra (default: 10.99 USD/mes)
    features: string[]; // Viñetas destacadas
    is_active: boolean;
    is_popular?: boolean;
    category: 'salon' | 'kiosk' | 'byod' | 'all_in_one' | 'addon' | 'custom';
    created_at?: string;
    updated_at?: string;
}

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
    {
        id: 'plan_exo_salon',
        name: 'Módulo Salón & Cocina (Exo Server)',
        description: 'Comandeo móvil para meseros desde sus teléfonos y pantalla KDS de cocina en tiempo real.',
        monthly_price: 99,
        setup_fee: 450,
        annual_price: 990,
        modules: {
            kiosk: false,
            kds: true,
            waitress_exo: true,
            qr_menu: true,
        },
        max_screens: 0, // 0 = Ilimitado BYOD
        extra_screen_price: 10.99,
        features: [
            'Modelo BYOD ($0 en Hardware): Tus meseros usan sus propios celulares (iPhone o Android)',
            'Pantalla de Cocina (KDS) en Vivo sincronizada en milisegundos con Supabase Realtime',
            'Mapeo interactivo de mesas con total acumulado y monitoreo de comandas',
            'Personalizador de comandas: notas rápidas ("Sin Cebolla", "Término Medio", "Salsa Aparte")',
            'Digitalización 100% de tu menú con fotos, precios e ingredientes incluida',
            'Capacitación presencial al equipo de meseros y cocina'
        ],
        is_active: true,
        is_popular: true,
        category: 'salon',
        created_at: '2026-10-15T00:00:00.000Z',
        updated_at: '2026-10-15T00:00:00.000Z',
    },
    {
        id: 'plan_kiosk_pro',
        name: 'Kiosko de Autoservicio Pro 11" (Llave en Mano)',
        description: 'Estación táctil de mostrador con hardware Samsung blindado que toma pedidos y cobra solo.',
        monthly_price: 99,
        setup_fee: 799,
        annual_price: 990,
        modules: {
            kiosk: true,
            kds: true,
            waitress_exo: false,
            qr_menu: true,
        },
        max_screens: 1, // 1 Kiosko base incluido
        extra_screen_price: 10.99,
        features: [
            'Tablet Samsung Galaxy Tab A9+ (11" HD grado comercial para 12h continuas)',
            'Soporte metálico antirrobo de acero pesado con cerradura de llave para mostrador',
            'Impresora térmica de 80mm de alto flujo con auto-corte de papel y Bluetooth',
            'Venta sugerida automática (+22% en ticket promedio con extras y bebidas)',
            'Envío directo a cocina (KDS) y comprobante impreso con número de pedido',
            'Modo blindado de pantalla (App Pinning) sin fugas a Android'
        ],
        is_active: true,
        is_popular: false,
        category: 'kiosk',
        created_at: '2026-10-15T00:00:00.000Z',
        updated_at: '2026-10-15T00:00:00.000Z',
    },
    {
        id: 'plan_kiosk_byod',
        name: 'Kiosko de Autoservicio BYOD (Trae tu Tablet)',
        description: 'Usa tu propia tablet o compra directo a fábrica; nosotros montamos el sistema y menú.',
        monthly_price: 99,
        setup_fee: 150,
        annual_price: 990,
        modules: {
            kiosk: true,
            kds: true,
            waitress_exo: false,
            qr_menu: true,
        },
        max_screens: 1,
        extra_screen_price: 10.99,
        features: [
            'Tú compras el hardware: Te damos la lista en Amazon (~$420 costo directo de fábrica)',
            'Instalación, montaje y blindaje del Kiosko en tu mostrador',
            'Carga inicial del menú con fotografías y modificadores',
            'Sincronización con pantalla de cocina KDS en tiempo real',
            'Soporte técnico continuo y actualizaciones en la nube'
        ],
        is_active: true,
        is_popular: false,
        category: 'kiosk',
        created_at: '2026-10-15T00:00:00.000Z',
        updated_at: '2026-10-15T00:00:00.000Z',
    },
    {
        id: 'addon_extra_screen',
        name: 'Licencia de Pantalla Adicional (Add-on)',
        description: 'Kiosko extra de autoservicio o pantalla de cocina (KDS) adicional para el restaurante.',
        monthly_price: 10.99,
        setup_fee: 0,
        modules: {
            kiosk: true,
            kds: true,
            waitress_exo: false,
            qr_menu: false,
        },
        max_screens: 1,
        extra_screen_price: 10.99,
        features: [
            'Licencia de software activa para 1 pantalla extra',
            'Kiosko adicional o segunda pantalla KDS de cocina',
            'Sincronización simultánea en la misma red y cuenta del restaurante',
            'Costo de hardware adicional se factura por separado si se requiere montaje'
        ],
        is_active: true,
        is_popular: false,
        category: 'addon',
        created_at: '2026-10-15T00:00:00.000Z',
        updated_at: '2026-10-15T00:00:00.000Z',
    }
];
