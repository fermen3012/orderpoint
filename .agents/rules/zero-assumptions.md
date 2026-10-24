# Regla Inquebrantable: Cero Suposiciones & Consulta Proactiva
> Estándar de Consultoría y Desarrollo SaaS — Exo Advance

**Estado:** INQUEBRANTABLE

1. **Prohibido Suponer Requisitos Críticos de Negocio:**
   - Ante especificaciones ambiguas, flujos de cobro/Stripe no detallados, permisos de usuario confusos o modelos de datos con múltiples interpretaciones:
   - **El agente debe pausar y preguntar al usuario antes de escribir código.**
   - Adivinar o asumir incorrectamente provoca refactorizaciones forzadas y desperdicio masivo de tokens.

2. **Propuesta con Opciones Claras:**
   - Al realizar una consulta aclaratoria, presentar opciones concretas de implementación (ej: "Opción A vs Opción B") con sus pros y contras técnicos para que el usuario pueda decidir en segundos.

3. **Advertencia de Impacto Previsto:**
   - Si una solicitud del usuario tiene el potencial de romper un módulo existente (ej: modificar una función compartida entre inventario y ventas), el agente debe advertir el riesgo antes de aplicar el cambio.