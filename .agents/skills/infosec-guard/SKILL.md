---
name: infosec-guard
description: Directivas de ciberseguridad, protección de datos confidenciales de clientes (PII), auditoría de permisos RLS y mitigación de vulnerabilidades web.
---

# Skill: Ciberseguridad & Protección de Datos de Clientes

Esta skill define los protocolos y salvaguardas obligatorias para blindar la información de los clientes, restaurantes y comensales en la plataforma OrderPoint.

## 1. Protección de Datos del Cliente (PII y Comandas)
- **Principio de Mínimo Privilegio:** Ningún cliente o usuario anónimo en el Kiosko debe tener visibilidad sobre las órdenes, nombres ni consumos de otros clientes.
- **Aislamiento de Órdenes:** Las consultas a `orders` y `order_items` deben validar que el solicitante pertenezca exclusivamente al `restaurant_id` de la comanda.
- **Sanitización de Entradas:** Filtrar y sanitizar notas especiales del cliente o nombres en el Kiosko para prevenir inyección de código (XSS) en la pantalla de cocina (KDS).

## 2. Seguridad en Pagos & Cumplimiento PCI-DSS
- **Cero Almacenamiento de Tarjetas:** Prohibido solicitar, transmitir o almacenar números de tarjeta, CVV o fechas de vencimiento en bases de datos o logs. Todo cobro debe delegarse exclusivamente a Stripe Checkout o Stripe Elements.
- **Validación de Webhooks:** Todo webhook proveniente de Stripe (`/api/webhooks/stripe`) debe validar criptográficamente el encabezado `stripe-signature` con el `STRIPE_WEBHOOK_SECRET` antes de modificar cualquier estado de suscripción.

## 3. Higiene de Secretos y Llaves de API
- **Exclusión de Service Role:** La variable `SUPABASE_SERVICE_ROLE_KEY` JAMÁS debe ser importada o referenciada en componentes marcados con `'use client'`.
- **Variables Públicas vs Privadas:** Solo las variables con prefijo `NEXT_PUBLIC_` pueden exponerse al cliente (ej. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Claves como `STRIPE_SECRET_KEY` o `GEMINI_API_KEY` deben residir estrictamente en Server Actions o API Routes protegidas por autenticación de Super Admin.

## 4. Prevención de IDOR y Escalamiento de Privilegios
- **Verificación de Propiedad:** En cualquier acción que modifique precios, productos, mesas o pedidos, no confiar únicamente en el ID recibido por parámetro. Validar que dicho registro pertenezca efectivamente al `restaurant_id` del usuario autenticado en sesión.
- **Políticas RLS en Supabase:** Auditar que toda tabla nueva tenga `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` y que no existan políticas permisivas de tipo `USING (true)` para operaciones destructivas (`UPDATE`, `DELETE`).
