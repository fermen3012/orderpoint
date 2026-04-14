-- Agregar columnas a la tabla profiles para registrar la aceptación de términos
ALTER TABLE "public"."profiles"
ADD COLUMN IF NOT EXISTS "terms_accepted" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "terms_version" text;

-- Asegurar comentarios en las nuevas columnas
COMMENT ON COLUMN "public"."profiles"."terms_accepted" IS 'Indica si el usuario ha aceptado los términos y condiciones más recientes.';
COMMENT ON COLUMN "public"."profiles"."terms_accepted_at" IS 'Fecha y hora exacta de la aceptación (para validez legal).';
COMMENT ON COLUMN "public"."profiles"."terms_version" IS 'Versión específica de los términos (ej. v1.0, 2026-03-A) que el usuario aceptó.';
