# Reglas del Proyecto orderpoint (AGENTS.md)
> **Estándar de Ingeniería de Software SaaS & Web — Exo Advance**  
> Gobernanza Multi-Agente, Memoria Persistente de Grafo y Protocolo Quirúrgico de Alta Densidad de Tokens.

---

## 🌟 1. Regla de Oro: Transparencia y Atribución
El Orquestador debe reportar explícitamente en cada respuesta la asignación y ejecución:

### Modo Modificación de Código / Tarea Estructural (Tabla Completa)
```markdown
### 🌟 Transparencia de Asignación y Ejecución (Exo Advance)
| Campo | Detalle |
| :--- | :--- |
| **A quién se asignó la tarea** | [Rol/Especialista delegado o Orquestador Senior] |
| **Quién realizó la tarea** | [Ejecutor Responsable] |
| **Resumen de acciones ejecutadas** | [Resumen conciso de cambios y verificaciones] |
```

### Modo Consulta / Aclaración Rápida (Micro-Badge para Ahorro de Tokens)
> 🛡️ **[Asignado: Rol/Especialista]** | **[Ejecutor: Responsable]** | [Acción concisa]

---

## 🧭 2. Enrutamiento Dinámico de Especialistas (Intent Dispatcher)
El Orquestador opera con despacho automático según `.agents/skills/registry.json`:
1. **Detección Automática:** Clasifica la intención del usuario y delega al especialista correspondiente (Backend, Frontend, UI, QA, InfoSec, Legal o Marketing).
2. **Auto-Spawn On-Demand:** Si la tarea requiere un especialista no registrado, el Orquestador crea automáticamente `.agents/skills/<rol>/SKILL.md`, lo registra en `registry.json` y ejecuta la tarea con rigor profesional.

---

## ⚡ 3. Protocolo de Ahorro y Disciplina de Tokens (L0 / L1 / L2)
1. **L0 (Contexto Base Activo & Esqueleto AST):**
   - Consultar `.agents/memory/invariants.json` y `graph.json` antes de intervenciones estructurales.
   - **Esqueleto de Firmas:** Consultar `.agents/memory/skeleton.compact` para ubicar líneas y funciones exactas sin leer archivos enteros a ciegas (ahorro del 85-95% de tokens).
   - Actualizar esqueleto y dependencias con: `node .agents/bin/scan.js` y `node .agents/bin/sync-graph.js`.
2. **L1 (Especialistas Bajo Demanda):** Cargar directivas de `.agents/skills/` únicamente cuando la tarea pertenezca a su dominio.
3. **L2 (Lectura y Edición Quirúrgica):**
   - **Lectura acotada:** En archivos de más de 80 líneas, usar `read_file` especificando `StartLine` y `EndLine`. Prohibido volcar archivos enteros.
   - **Edición precisa:** Usar `edit_file` para bloques contiguos exactos. Prohibido reescribir archivos enteros que ya funcionan.
   - **No duplicación:** Tras modificar archivos con herramientas, no re-imprimir el archivo completo en la respuesta de chat.

---

## 🧠 3.1 Protocolo Anti-Amnesia & Memoria Continua
Para evitar la pérdida de contexto entre sesiones o compactaciones de chat:
1. **Inicio de Sesión (Recuperación Inmediata de Contexto):**
   - El agente DEBE consultar `.agents/memory/state.json` (<30 líneas, ~150 tokens) antes de comenzar cualquier tarea compleja.
   - Esto reactiva de inmediato el historial de hitos completados, el trabajo en curso y las decisiones de arquitectura adoptadas, eliminando la necesidad de re-explicar el proyecto.
2. **Cierre de Tarea (Persistencia Obligatoria de Estado):**
   - Al finalizar cada intervención o hito, el agente DEBE actualizar `.agents/memory/state.json`:
     - Marcar el hito finalizado en `milestones`.
     - Documentar cualquier cambio o decisión clave en `decisions`.
     - Actualizar la lista de `priorities` para la siguiente sesión.
3. **Preservación Inmune a Actualizaciones:**
   - Tanto `setup.js` como `upgrade.js` ejecutan fusión inteligente (`smartMergeMemory`), garantizando que jamás se sobreescriban los hitos, decisiones, invariantes ni nodos del grafo de conocimiento preexistentes.
   - Se crea automáticamente un respaldo preventivo fechado en `.agents.backup_YYYYMMDD_HHMMSS`.

---

## 🔌 4. Integración MCP (Supabase, Vercel & Git/GitHub Tooling)
El proyecto incluye configuración nativa de **Model Context Protocol (`.mcp.json`)**:
- **Supabase & PostgreSQL MCP:** Permite al agente inspeccionar esquemas de tablas, validar políticas RLS y ejecutar consultas `SELECT` seguras para prototipado sin salir del flujo de trabajo.
- **Vercel MCP:** Permite al agente inspeccionar la salud de builds, consultar logs de error de funciones serverless en vivo y auditar variables de entorno.
- **Git & GitHub MCP:** Permite al agente auditar diffs, realizar commits semánticos y sincronizar con repositorios remotos.
- **Seguridad:** Las credenciales se gestionan exclusivamente mediante variables de entorno en `.env.mcp` (ignorado en git vía `.gitignore`). Prohibido escribir claves reales en `.mcp.json`.

---

## 🏛️ 5. Las 8 Reglas Inquebrantables de Exo Advance
Cualquier agente que opere en este proyecto debe respetar estrictamente:
1. **Conservación de Tokens & Máxima Velocidad (`.agents/rules/token-conservation-velocity.md`):** AST Skeleton first (`skeleton.compact`), lecturas acotadas `StartLine-EndLine`, cero repetición de código en chat y ejecución unificada de QA Gate.
2. **Despliegues y Git Push Bajo Orden Expresa (`.agents/rules/deployment-on-command.md`):** Prohibido hacer push o desplegar en Vercel de forma autónoma. Solo se ejecuta bajo orden directa del usuario tras pasar el QA Gate.
3. **Inmunidad de Arquitectura (`.agents/rules/architecture-immunity.md`):** Prohibido tocar enrutadores (`App.tsx`, layouts), lógica de autenticación o Contextos globales (`AppContext`, `AuthContext`) sin permiso explícito.
4. **Integridad de Tipos (`.agents/rules/type-integrity.md`):** Prohibido inventar propiedades arbitrarias. Toda modificación debe cumplir las interfaces definidas (`types.ts`).
5. **Fidelidad y Congelamiento Visual (`.agents/rules/ui-freeze-fidelity.md`):** Componentes nuevos deben clonar el lenguaje visual exacto (Tailwind, bordes `rounded-[32px]`, paleta y tipografías). Prohibido rediseñar pantallas que ya funcionan.
6. **Cero Suposiciones (`.agents/rules/zero-assumptions.md`):** Ante requerimientos ambiguos o riesgos de rotura en producción, el agente debe consultar al usuario antes de programar.
7. **Modificaciones Quirúrgicas (`.agents/rules/surgical-modifications.md`):** Cambios mínimos indispensables por bloques contiguos exactos.
8. **QA Gate Automatizado (`.agents/bin/verify.js`):** Toda entrega debe validarse con `node .agents/bin/verify.js` obteniendo `PASS` (cero errores de tipos, cero secretos expuestos e integridad preservada).
