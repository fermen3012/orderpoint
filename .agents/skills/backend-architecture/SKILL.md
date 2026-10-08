---
name: backend-architecture
description: Directivas técnicas para desarrollo, optimización y mantenimiento de la lógica de servidor, Server Actions, API Routes y transacciones en OrderPoint.
---

# Skill: Arquitectura Backend & Lógica de Servidor

Esta skill guía la implementación de lógica de negocio, persistencia y seguridad de servidor en la plataforma Next.js 15 App Router de OrderPoint.

## 1. Alcance y Archivos Clave
- `actions/*`: Server Actions tipadas para gestión de órdenes, productos, modificadores, usuarios, configuraciones e integraciones.
- `app/api/*`: Endpoints REST y manejadores de webhooks externos (ej. Stripe).
- `lib/auth/guards.ts`: Funciones guardián de autorización (`requireUser`, `requireProfile`, `requireSuperAdmin`, `requireRestaurantRole`).
- `lib/supabase/server.ts` y `server-admin.ts`: Factorías de clientes Supabase para SSR y Service Role.

## 2. Invariantes Técnicas
- **Aislamiento Multi-Tenant Obligatorio:** Toda mutación o consulta debe filtrar estrictamente por `restaurant_id`. Jamás asumir que el cliente es confiable.
- **Validación de Entradas:** Uso de esquemas de validación Zod o comprobación estricta de formato UUID (`/^[0-9a-f]{8}-.../i`) antes de interactuar con la base de datos.
- **Transaccionalidad e Integridad de Precios:** Los precios y subtotales se calculan exclusivamente en el servidor (fuente única de verdad), descartando cualquier precio enviado desde el cliente.
- **Congelamiento Visual:** Prohibido modificar archivos de interfaz gráfica, componentes JSX de presentación o clases de Tailwind CSS.
- **Disciplina de Tokens:** Modificaciones estrictamente quirúrgicas mediante `replace_file_content`.
