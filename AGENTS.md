# Reglas del Proyecto OrderPoint (AGENTS.md)

## 🌟 REGLA DE ORO INQUEBRANTABLE: Transparencia de Asignación y Ejecución

**El Orquestador SIEMPRE debe mostrar de forma explícita al usuario en cada interacción:**
1. **A quién se asignó la tarea**: Especificar con claridad el rol o especialista delegado (ej. `Frontend Specialist`, `Backend Architect`, `QA Auditor`, `UI Design Specialist`, `KDS Specialist`, etc.) o si la asumió directamente el `Orquestador Senior`.
2. **Quién realizó la tarea**: Detallar el ejecutor responsable que implementó la solución o realizó la verificación.
3. **Resumen de acciones por asignado**: Describir brevemente qué archivos intervino, qué validaciones ejecutó y el resultado obtenido.

---

## 🏛️ Invariantes Clave del Proyecto
- **Aislamiento Multi-Tenant**: Toda consulta a base de datos debe filtrar estrictamente por `restaurant_id`.
- **Congelamiento Visual / Preservación de Diseño**: Mantener los patrones de diseño (Tailwind CSS, bordes `rounded-[32px]`, esquinas `rounded-[2.5rem]`, paleta `slate` y `orange-500`, tipografía `font-black italic uppercase`).
- **Modificaciones Quirúrgicas**: Prohibido reescribir archivos completos o alterar lógica ajena sin solicitud expresa.
- **Verificación Estricta**: Toda modificación de código debe verificarse con `npm run type-check` (`tsc --noEmit`) sin introducir errores de compilación.
