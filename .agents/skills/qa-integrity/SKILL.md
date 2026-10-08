---
name: qa-integrity
description: Procedimientos de control de calidad, verificación de tipos TypeScript, auditoría de no-regresión visual (Tailwind freeze) y cumplimiento de invariantes de OrderPoint.
---

# Skill: Control de Calidad (QA), Verificación TypeScript & Auditoría

Esta skill define el protocolo de verificación previa a la entrega de cualquier cambio en OrderPoint.

## 1. Alcance y Tareas de Auditoría
- **Chequeo de Tipos TypeScript:** Ejecución y verificación estricta de compilación (`tsc --noEmit` o `npm run type-check`). Cero errores de tipos permitidos.
- **Auditoría de Invariantes Visuales:** Comprobar que ningún cambio modifique clases de diseño visual (Tailwind), bordes redondeados, colores o fuentes preexistentes.
- **Auditoría de Invariantes Multi-Tenant:** Asegurar que ninguna consulta o modificación a base de datos carezca del filtro `restaurant_id`.
- **Auditoría de Diffs Quirúrgicos:** Verificar que las modificaciones utilicen bloques contiguos precisos para ahorrar tokens y evitar reescritura de código que ya funciona.

## 2. Salida de Reporte
Todo reporte de QA debe ser conciso, estructurado y listar:
1. Estado del type-check (`PASS` / `FAIL` con detalles).
2. Verificación de diseño congelado (`INTACTO`).
3. Verificación de aislamiento multi-tenant (`PROTEGIDO`).
