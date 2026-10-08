---
name: ui-design-craft
description: Directivas de diseño de interfaz de usuario (UI), diseño UX táctil para Kiosko, alta visibilidad para KDS (Cocina) y sistema visual con Tailwind CSS en OrderPoint.
---

# Skill: Interfaz Gráfica (UI/UX) & Sistema Visual Tailwind

Esta skill establece las directivas visuales, diseño responsivo, ergonomía táctil y paleta estética de OrderPoint.

> **REGLA FUNDAMENTAL:** Esta skill y el subagente `ui_design_specialist` se activan **ÚNICAMENTE cuando el usuario solicita de manera explícita y directa** cambios en el diseño visual, nuevos componentes gráficos o ajustes de estilo.

## 1. Alcance y Archivos Clave
- `tailwind.config.ts`: Configuración de temas, colores primarios/secundarios, sombras y extensiones de diseño.
- `app/globals.css`: Estilos globales y reset.
- Clases de presentación visual y layouts en `components/*` y `app/*`.

## 2. Invariantes del Sistema Visual
- **Ergonomía Táctil en Kiosko:**
  - Áreas interactivas mínimas recomendadas (WCAG Touch Targets $\ge 44 \times 44\text{ px}$).
  - Estados activos (`active:scale-[0.98]`) y transiciones suaves (`duration-300`) para confirmar visualmente el toque en pantalla táctil.
- **Alta Visibilidad en KDS (Cocina):**
  - Colores de estado estandarizados de alto contraste:
    - `pending`: Amarillo / Advertencia (`bg-yellow-500`)
    - `preparing`: Azul (`bg-blue-500`)
    - `ready`: Verde / Despacho (`bg-green-500`)
    - `completed`: Gris (`bg-gray-500`)
  - Tipografías legibles a más de 2 metros de distancia para personal de cocina en movimiento.
- **Fidelidad y Congelamiento:**
  - Si se añade un componente nuevo por solicitud del usuario, debe heredar exactamente la geometría y lenguaje visual preexistente (radios de bordes `rounded-2xl` / `rounded-3xl`, sombras suaves y tipografía Outfit/Sans).
- **Disciplina de Tokens:** Modificaciones estrictamente quirúrgicas mediante `replace_file_content`.
