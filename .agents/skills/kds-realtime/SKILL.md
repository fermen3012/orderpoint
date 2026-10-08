---
name: kds-realtime
description: Directivas técnicas especializadas para el Kitchen Display System (KDS / Pantalla de Cocina) y la sincronización reactiva en tiempo real mediante Supabase Realtime.
---

# Skill: Kitchen Display System (KDS) & Supabase Realtime

Esta skill guía la implementación, depuración y mantenimiento de la **Pantalla de Cocina (KDS)** en OrderPoint.

## 1. Alcance y Archivos Clave
- `app/[locale]/(kitchen)/kitchen/page.tsx`: Vista operativa de cocina para recepción y despacho de comandas.
- `app/[locale]/(kitchen)/layout.tsx`: Layout con inyección de contexto de cocina y resolución de `restaurant_id`.

## 2. Invariantes del Flujo de Comandas
- **Suscripción Realtime:** Mantener canal activo a Supabase (`postgres_changes` sobre tabla `orders` y `order_items`) filtrando por `restaurant_id`.
- **Transición de Estados con Timestamps:**
  1. `pending`: Orden recién ingresada (color amarillo).
  2. `preparing`: Cocinero inicia preparación; registrar `preparing_at = now()`.
  3. `ready`: Pedido listo para entrega; registrar `ready_at = now()`.
  4. `completed`: Pedido despachado al cliente; registrar `completed_at = now()`.
- **Desglose de Comanda:** Renderizar con claridad los modificadores seleccionados y los ingredientes explícitamente removidos por el comensal.
- **Diseño Congelado:** Prohibido modificar los códigos de color, tamaños de tarjeta o layout de la pantalla de cocina sin petición directa.
