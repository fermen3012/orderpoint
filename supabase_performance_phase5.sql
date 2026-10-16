-- ============================================================================
-- ORDERPOINT SAAS - OPTIMIZACIÓN DE RENDIMIENTO FASE 5 (JWT CLAIMS & ÍNDICES)
-- Ejecutar en Supabase SQL Editor (100% Seguro e Idempotente, 0 pérdida de datos)
-- ============================================================================

-- 1. Índices compuestos para Catálogo de Productos y Categorías por Restaurante:
CREATE INDEX IF NOT EXISTS idx_products_restaurant_available
ON public.products (restaurant_id, is_available);

CREATE INDEX IF NOT EXISTS idx_categories_restaurant_sort
ON public.categories (restaurant_id, sort_order);

-- 2. Función y Trigger para sincronizar role, restaurant_id e is_super_admin
-- dentro de auth.users.raw_app_meta_data (elimina queries a profiles en Middleware):
CREATE OR REPLACE FUNCTION public.sync_profile_claims_to_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
        'role', NEW.role,
        'restaurant_id', NEW.restaurant_id,
        'is_super_admin', COALESCE(NEW.is_super_admin, false)
    )
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_claims_to_auth ON public.profiles;
CREATE TRIGGER trg_sync_profile_claims_to_auth
AFTER INSERT OR UPDATE OF role, restaurant_id, is_super_admin
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_claims_to_auth();

-- 3. Backfill inicial para todos los perfiles existentes:
UPDATE auth.users u
SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
    'role', p.role,
    'restaurant_id', p.restaurant_id,
    'is_super_admin', COALESCE(p.is_super_admin, false)
)
FROM public.profiles p
WHERE u.id = p.id;
