# Regla Inquebrantable: Integridad de Contratos de Tipos (TypeScript & DB)
> Estándar de Ingeniería de Software SaaS — Exo Advance

**Estado:** INQUEBRANTABLE

1. **Respeto Absoluto a los Types:**
   - Toda modificación de código debe ajustarse estrictamente a las interfaces y tipos definidos en los contratos del proyecto (ej: `types.ts`, interfaces de API, modelos de ORM).
   - Prohibido "alucinar" o inventar nuevas propiedades en objetos, props de componentes o registros de base de datos si no forman parte del contrato oficial.

2. **Flujo de Evolución de Contratos:**
   - Si una funcionalidad legítimamente requiere una nueva propiedad, primero debe definirse y documentarse en el archivo de tipos correspondiente con su tipado exacto (evitando el uso de `any`).
   - Posteriormente se implementa en los componentes o servicios afectados.

3. **Compilación Limpia (Zero Errors):**
   - El código debe compilar limpiamente sin errores de tipos ni advertencias críticas antes de dar la tarea por concluida (`node .agents/bin/verify.js`).