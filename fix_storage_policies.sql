-- 1. Aseguramos que el bucket "products" exista y sea público
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Eliminamos políticas anteriores para evitar conflictos (opcional, pero recomendado para limpiar)
DROP POLICY IF EXISTS "Public Access Select" ON storage.objects;
DROP POLICY IF EXISTS "Auth Access Insert" ON storage.objects;
DROP POLICY IF EXISTS "Auth Access Update" ON storage.objects;
DROP POLICY IF EXISTS "Auth Access Delete" ON storage.objects;

-- 3. Crear Políticas de Acceso (RLS)

-- A. PERMITIR LECTURA PÚBLICA (Cualquiera puede ver las imágenes)
CREATE POLICY "Public Access Select"
ON storage.objects FOR SELECT
USING ( bucket_id = 'products' );

-- B. PERMITIR SUBIDA (INSERT) SOLO A USUARIOS AUTENTICADOS (Logueados)
CREATE POLICY "Auth Access Insert"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'products' AND auth.role() = 'authenticated' );

-- C. PERMITIR ACTUALIZACIÓN (UPDATE) SOLO A DUEÑOS (O Admin)
CREATE POLICY "Auth Access Update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'products' AND auth.role() = 'authenticated' );

-- D. PERMITIR ELIMINACIÓN (DELETE) SOLO A DUEÑOS (O Admin)
CREATE POLICY "Auth Access Delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'products' AND auth.role() = 'authenticated' );
