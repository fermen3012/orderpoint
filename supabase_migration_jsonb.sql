-- 1. Alterar columnas a JSONB manteniendo los datos existentes en formato de claves 'es' y 'en'
ALTER TABLE public.products 
  ALTER COLUMN name TYPE jsonb USING jsonb_build_object('es', name, 'en', ''),
  ALTER COLUMN description TYPE jsonb USING jsonb_build_object('es', COALESCE(description_es, ''), 'en', COALESCE(description, ''));

-- 2. Eliminar columna description_es redundante
ALTER TABLE public.products DROP COLUMN IF EXISTS description_es;

-- 3. Crear Trigger para evitar bucles infinitos en el webhook de traducción
-- El trigger solo se disparará si el campo en inglés de nombre o descripción está vacío, evitando ejecuciones redundantes tras la actualización de la Edge Function.
CREATE OR REPLACE FUNCTION public.should_translate_product()
RETURNS trigger AS $$
BEGIN
  IF (NEW.name->>'en' = '' OR NEW.name->>'en' IS NULL) OR 
     (NEW.description IS NOT NULL AND (NEW.description->>'en' = '' OR NEW.description->>'en' IS NULL)) THEN
    RETURN NEW;
  END IF;
  RETURN NULL; -- Cancela el disparo del webhook si ya está traducido
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_product_translate_check ON public.products;
CREATE TRIGGER trigger_product_translate_check
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.should_translate_product();
