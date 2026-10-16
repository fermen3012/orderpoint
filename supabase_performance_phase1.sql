-- ============================================================================
-- ORDERPOINT SAAS - OPTIMIZACIÓN DE RENDIMIENTO FASE 1 (REALTIME & KDS/MESAS)
-- Ejecutar en Supabase SQL Editor (100% Seguro e Idempotente, 0 pérdida de datos)
-- ============================================================================

-- 1. Índice compuesto para Pantalla de Cocina (KDS):
-- Acelera drásticamente: .eq('restaurant_id', id).neq('status', 'completed').order('created_at', { ascending: true })
CREATE INDEX IF NOT EXISTS idx_orders_kds_active
ON public.orders (restaurant_id, status, created_at ASC)
WHERE status <> 'completed';

-- 2. Índice compuesto para Historial y Consultas de Órdenes por Restaurante:
-- Acelera drásticamente lecturas filtradas por restaurant_id y ordenadas por fecha
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created_at
ON public.orders (restaurant_id, created_at DESC);

-- 3. Índice en Foreign Key de order_items(order_id):
-- Crítico para evitar Sequential Scans durante el JOIN de orders -> order_items en KDS y Admin
CREATE INDEX IF NOT EXISTS idx_order_items_order_id
ON public.order_items (order_id);

-- 4. Índice compuesto para Mesas (Exo Server):
-- Acelera: .from('tables').eq('restaurant_id', id).order('number')
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_number
ON public.tables (restaurant_id, number);
