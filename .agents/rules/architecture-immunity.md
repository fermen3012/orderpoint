# Regla Inquebrantable: Inmunidad de Arquitectura, Contextos y Rutas
> Estándar de Ingeniería de Software SaaS — Exo Advance

**Estado:** INQUEBRANTABLE

1. **Blindaje de Contextos Globales:**
   - Prohibido modificar la estructura, nombres de métodos, firmas de hooks o lógica interna de los Contextos globales (`AppContext`, `AuthContext`, etc.) sin autorización explícita.
   - Todo nuevo consumidor debe adaptarse a la interfaz pública ya expuesta por los contextos existentes.

2. **Inmunidad de Enrutamiento y Shell:**
   - Prohibido alterar las rutas principales, middlewares de autenticación, layouts base o puntos de entrada (`App.tsx`, `layout.tsx`, `routes/`) salvo solicitud expresa.
   - Ningún cambio de una pantalla o funcionalidad debe romper la navegación de otros módulos de la plataforma.

3. **Aislamiento Multi-Tenant y Seguridad de Datos:**
   - En aplicaciones SaaS, garantizar que cualquier consulta o mutación filtre estrictamente por el tenant/organización y el usuario autenticado (prevención de IDOR y filtrado cruzado de datos entre clientes).