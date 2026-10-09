---
name: translation-i18n
description: Directivas técnicas para gestión de traducciones multi-idioma (Español / Inglés), internacionalización con next-intl, paridad de claves en messages/es.json y messages/en.json, y switches de idioma en OrderPoint.
---

# Skill: Especialista en Traducciones e Internacionalización (i18n)

Esta skill guía el mantenimiento y expansión del sistema multi-idioma (Español e Inglés) en OrderPoint mediante `next-intl`.

## 1. Alcance y Archivos Clave
- `messages/es.json`: Catálogo de traducciones en Español.
- `messages/en.json`: Catálogo de traducciones en Inglés.
- `i18n/routing.ts` & `i18n.ts`: Configuración de enrutamiento y detección de locales.
- Componentes de conmutación de idioma (`ExoLanguageSwitch.tsx`, etc.).
- Consumo mediante hook `useTranslations('namespace')` en Client Components y `getTranslations` en Server Components.

## 2. Invariantes Técnicas
- **Paridad Absoluta de Claves:** Toda clave que se agregue o modifique en `messages/es.json` DEBE existir con la misma estructura y variables (`{name}`, `{count}`, etc.) en `messages/en.json`.
- **Valores Localizados Dinámicos:** Para campos de base de datos multilingües (JSON o string con nombres de productos o categorías), usar `getLocalizedValue(field, locale)`.
- **Aislamiento de Módulos:** No alterar traducciones ni componentes de módulos ajenos a la tarea actual.
- **Congelamiento Visual:** No alterar márgenes, layouts ni colores preestablecidos; el switch de idioma debe respetar el diseño rounded, colores slate y acentos del módulo.
- **Modificaciones Quirúrgicas:** Realizar cambios mínimos y precisos sin reescribir archivos innecesariamente.
