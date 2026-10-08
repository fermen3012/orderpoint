---
name: frontend-architecture
description: Directivas técnicas para desarrollo de componentes React, gestión de estado con Zustand, hooks, internacionalización (next-intl) y lógica de cliente en OrderPoint.
---

# Skill: Arquitectura Frontend & Lógica de Cliente

Esta skill guía el desarrollo, rendimiento y estabilidad de la capa cliente en OrderPoint.

## 1. Alcance y Archivos Clave
- `components/*`: Componentes funcionales e interactivos de Kiosko, KDS (Cocina), Administración y Super Admin.
- `store/*`: Stores globales de Zustand (ej. `useCartStore` para el carrito y personalizaciones).
- `hooks/*`: Hooks personalizados para ciclo de vida, reconexión y hardware (Bluetooth).
- `i18n/*` y `messages/*`: Configuración de enrutamiento y catálogos de traducción de `next-intl`.

## 2. Invariantes Técnicas
- **Separación de Frontera Servidor/Cliente:** Componentes interactivos que usen estado o hooks de navegador deben incluir la directiva `'use client'` al inicio del archivo.
- **Gestión de Estado Robusta:** Centralizar cálculos del carrito y selección de opciones en Zustand, manteniendo sincronizado el estado visual.
- **Congelamiento Visual:** Prohibido modificar clases de Tailwind, fuentes, márgenes, bordes o paletas de colores preexistentes sin autorización explícita.
- **Manejo de Errores y Cargas:** Proporcionar estados de carga (`loading`) y captura de errores sin provocar saltos bruscos en el DOM (evitar CLS).
- **Disciplina de Tokens:** Modificaciones estrictamente quirúrgicas mediante `replace_file_content`.
