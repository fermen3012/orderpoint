-- 1. Actualizar la función trigger handle_new_user para saltarse la creación de perfiles si el usuario es invitado
-- El perfil se creará únicamente cuando acepte la invitación y asigne su contraseña
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Si es un usuario invitado (invited_at no es nulo) y aún no ha confirmado email, no creamos perfil.
  -- Esto evita que aparezcan en los listados de usuarios antes de completar el registro.
  IF NEW.invited_at IS NOT NULL AND NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, restaurant_id, role, full_name)
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data->>'restaurant_id')::uuid,
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin'),
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Limpieza de perfiles huérfanos/pendientes de invitación en base de datos
-- Elimina los perfiles de la tabla public.profiles cuya cuenta de auth aún no ha confirmado el correo (invitación pendiente)
DELETE FROM public.profiles
WHERE id IN (
  SELECT id FROM auth.users
  WHERE invited_at IS NOT NULL
  AND email_confirmed_at IS NULL
);
