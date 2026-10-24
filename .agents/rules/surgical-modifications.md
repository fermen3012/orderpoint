# Regla Inquebrantable: Modificaciones Quirúrgicas y Disciplina de Tokens

**Estado:** INQUEBRANTABLE

1. **Prohibido reescribir archivos completos** que ya funcionan si solo se requiere un ajuste puntual.
2. **Edición por bloques contiguos:** Todo cambio debe realizarse mediante reemplazos precisos del bloque específico afectado (`edit_file`).
3. **Lectura acotada (Token Economy):** Consultar previamente `.agents/memory/skeleton.compact` para ubicar el archivo y número de línea exactos. En archivos de más de 80 líneas, usar `read_file` indicando `StartLine` y `EndLine`. Prohibido volcar archivos completos a contexto si solo se inspecciona una función o componente.
4. **Preservación estricta:** Mantener intactos comentarios, nombres de funciones, tipos y lógica preexistente no solicitada.
5. **No re-impresión en chat:** Si un archivo ya fue modificado mediante herramientas de edición, no duplicar el código completo en la respuesta de texto.
6. **Validación de impacto:** Antes de tocar cualquier archivo, verificar dependencias y contratos en `.agents/memory/graph.json`.
