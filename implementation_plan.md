# Plan de Implementación: Vista de Configuraciones para Super Admin (Stripe e IA)

Este plan detalla el diseño técnico para crear una nueva página de **Configuraciones** accesible exclusivamente por Super Administradores. Permite configurar de forma dinámica los credenciales de Stripe (API de Cobro) y preparar los campos para el agente de Inteligencia Artificial (Gemini API) en el futuro, guardándolos de forma segura en la base de datos con políticas RLS de Super Admin.

## Cambios Propuestos

---

### 1. Base de Datos (Supabase)

#### [NEW] [supabase_settings_table.sql](file:///c:/xampp/htdocs/orderpoint/supabase_settings_table.sql)
Crearemos una nueva tabla `system_settings` para almacenar pares clave-valor de configuración del sistema (como API Keys) de forma segura en Postgres.

```sql
-- Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Create policies (only super admins can view or modify system settings)
CREATE POLICY "Super Admins can manage system settings" 
ON public.system_settings
FOR ALL 
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());
```

---

### 2. Backend (Server Actions y Configuración Dinámica)

#### [NEW] [actions/settings.ts](file:///c:/xampp/htdocs/orderpoint/actions/settings.ts)
Crearemos las acciones de servidor para obtener y guardar configuraciones en la base de datos de manera segura, validando que el usuario tenga rol de `super_admin`.

#### [MODIFY] [lib/stripe.ts](file:///c:/xampp/htdocs/orderpoint/lib/stripe.ts)
Modificaremos la inicialización de Stripe para permitir resolver la clave de forma dinámica. Crearemos una función `getDynamicStripe()` que busque la clave en `system_settings` y, si no existe, use la variable de entorno `process.env.STRIPE_SECRET_KEY` como fallback.

#### [MODIFY] [actions/stripe-admin.ts](file:///c:/xampp/htdocs/orderpoint/actions/stripe-admin.ts)
Actualizaremos las funciones de facturación para utilizar la instancia dinámica de Stripe obtenida por la nueva función helper.

---

### 3. Interfaz de Usuario (Super Admin Panel)

#### [MODIFY] [layout.tsx](file:///c:/xampp/htdocs/orderpoint/app/[locale]/(super-admin)/layout.tsx)
Añadiremos el botón **Configuraciones** en el menú de navegación lateral para el Super Admin:
```tsx
{ icon: <Settings className="w-5 h-5" />, label: 'Configuraciones', href: '/super-admin/settings' }
```

#### [NEW] [page.tsx](file:///c:/xampp/htdocs/orderpoint/app/[locale]/(super-admin)/super-admin/settings/page.tsx)
Diseñaremos una página de configuraciones con la estética premium del panel (tema oscuro, bordes de 32px/2rem, colores slate y emerald, tipografía Outfit):
* **Sección Stripe**: Campos para `Stripe Publishable Key`, `Stripe Secret Key`, y `Stripe Webhook Secret`.
* **Sección Inteligencia Artificial**: Campos para `Gemini API Key` y `AI Customer Service Prompt` (para configurar el agente en el futuro).
* Botones para guardar cada configuración de forma independiente con estados de carga.

---

## Plan de Verificación

### Pruebas Manuales
1. Aplicar la migración SQL.
2. Iniciar sesión como Super Admin y verificar que aparezca la opción **Configuraciones** en el menú lateral.
3. Guardar credenciales de Stripe y Gemini ficticias en el panel, verificando que se almacenen correctamente en la base de datos.
4. Validar que la tabla `system_settings` no pueda ser accedida por usuarios con roles inferiores (verificación de RLS).
