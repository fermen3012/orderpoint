---
name: multi-tenant-guard
description: Procedimientos y directivas para garantizar el aislamiento absoluto multi-tenant por restaurant_id, auditoría de políticas RLS y esquemas de base de datos Supabase.
---

# Skill: Aislamiento Multi-Tenant & Seguridad de Datos

Esta skill establece los procedimientos de protección y auditoría de datos para la plataforma multi-tenant OrderPoint.

## 1. Alcance y Archivos Clave
- `components/auth/AuthContext.tsx`: Proveedor de autenticación unificado con `restaurantId` y rol de usuario.
- `lib/supabase/client.ts` y `server.ts`: Inicialización de clientes Supabase anon y service_role.
- `supabase/*.sql`: Esquemas, tablas, funciones y políticas de Row Level Security (RLS).
- `actions/users.ts`: Operaciones seguras sobre personal del restaurante.

## 2. Reglas Inquebrantables
- **Cláusula WHERE Obligatoria:** Toda lectura, inserción, actualización o eliminación en tablas del negocio (`products`, `categories`, `orders`, `order_items`, `modifier_groups`, `ingredients`, `tables`) DEBE estar acotada por `restaurant_id`.
- **Auditoría RLS:** Ninguna tabla expuesta debe carecer de políticas RLS activadas.
- **Roles Válidos:** `super_admin` (control global de plataforma), `owner` / `admin` (dueño/administrador local), `kitchen` (pantalla KDS), `kiosk` (terminal autoservicio), `mesera` (salón/comandas).
