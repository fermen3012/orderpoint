---
name: admin-billing-ai
description: Procedimientos para administración de restaurantes, panel Super Admin, facturación con Stripe Subscriptions y traducciones automáticas con Google Gemini AI.
---

# Skill: Administración, Facturación Stripe & Gemini AI

Esta skill guía las operaciones del panel administrativo, gestión de locales, planes de suscripción y servicios de inteligencia artificial.

## 1. Alcance y Archivos Clave
- `app/[locale]/(admin)/admin/*`: Páginas de productos, categorías, ingredientes, mesas, horarios, pedidos y facturación.
- `app/[locale]/(super-admin)/super-admin/*`: Panel de Super Admin, métricas globales, aprovisionamiento de restaurantes y configuración dinámica.
- `actions/settings.ts`: Almacenamiento seguro de variables del sistema en la tabla `system_settings`.
- `lib/stripe.ts` y `actions/stripe-admin.ts`: Integración con Stripe API, checkout de suscripciones y facturación recurrente.
- `actions/translate-gemini.ts`: Traducción de descripciones gastronómicas al inglés/español utilizando la API de Google Gemini.

## 2. Invariantes
- **Configuraciones Seguras:** Las credenciales de Stripe y Gemini se leen prioritariamente de la tabla `system_settings` en Supabase (con RLS exclusiva de Super Admin) y con fallback a variables de entorno.
- **Diseño Congelado:** Respetar los layouts de dashboard, barras laterales, modales de formulario y paleta visual establecida.
