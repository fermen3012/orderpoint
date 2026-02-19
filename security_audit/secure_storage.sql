-- =========================================================================================
-- SECURE STORAGE POLICIES (Images)
-- =========================================================================================

-- Ensure RLS is enabled on objects (Comentado para evitar error 42501: must be owner)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 1. DROP EXISTING LOOSE POLICIES (Cleanup)
DROP POLICY IF EXISTS "Public Access Select" ON storage.objects;
DROP POLICY IF EXISTS "Auth Access Insert" ON storage.objects;
DROP POLICY IF EXISTS "Auth Access Update" ON storage.objects;
DROP POLICY IF EXISTS "Auth Access Delete" ON storage.objects;
-- Also drop policies created by previous scripts if named differently
DROP POLICY IF EXISTS "Give me access to own folder" ON storage.objects; 

-- 2. ALLOW PUBLIC READ (Images are public)
CREATE POLICY "Public: Read Images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'products' );

-- 3. SECURE UPLOAD (Authenticated + Size Limit + Mime Type)
CREATE POLICY "Secure Upload: Auth & Valid Image"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'products' 
  AND auth.role() = 'authenticated'
  -- Restrict File Types (Extensions)
  AND (lower(storage.extension(name)) = ANY (ARRAY['jpg', 'jpeg', 'png', 'webp', 'gif']))
  -- Note: Supabase Storage file size limit is usually global, but we can't easily enforce specific size in RLS 
  -- without metadata extensions, but typically this is done in Client or Edge Function.
  -- Verification of 'owner' usually requires folder matches user ID, but for shared product bucket:
  -- AND (storage.foldername(name))[1] = 'products'
);

-- 4. SECURE UPDATE/DELETE
CREATE POLICY "Secure Owners: Update/Delete"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'products' 
  AND auth.role() = 'authenticated'
  AND owner = auth.uid() -- Only uploader can change it
);

CREATE POLICY "Secure Owners: Delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'products' 
  AND auth.role() = 'authenticated'
  AND owner = auth.uid()
);
