# Regla Inquebrantable: Fidelidad de Diseño Visual & Congelamiento de UI
> Estándar de Diseño de Software SaaS & Web — Exo Advance

**Estado:** INQUEBRANTABLE

1. **Preservación y Congelamiento Visual:**
   - Prohibido rediseñar, cambiar márgenes, colores, tipografías o reestructurar componentes visuales preexistentes que ya funcionan, a menos que el usuario lo solicite expresamente.
   - Si una pantalla ya está en producción o validada por el cliente, su diseño está **congelado**.

2. **Clonación de Lenguaje Visual en Nuevos Componentes:**
   - Cualquier pantalla, modal, formulario o botón nuevo debe imitar al 100% el lenguaje visual existente en el proyecto:
     - Mismas clases de Tailwind CSS (ej. radios de borde `rounded-[32px]` o consistentes con el kit del cliente).
     - Misma paleta de colores corporativos (acentos, neutrales, estados hover/active).
     - Misma tipografía, jerarquía de pesos visuales y estilos de espaciado.

3. **Cero Dependencias de Estilos Conflictivas:**
   - Prohibido mezclar librerías de estilos ajenas o introducir CSS en línea arbitrario que colisione con el sistema de diseño ya adoptado.
   - Garantizar responsividad fluida (mobile-ready y desktop-grade).