---
name: kiosk-hardware
description: Directivas técnicas especializadas para el desarrollo y soporte del Kiosko de Autoservicio y la integración con impresoras térmicas Bluetooth ESC/POS (58mm/80mm).
---

# Skill: Kiosko de Autoservicio & Hardware Térmico ESC/POS

Esta skill guía la implementación, depuración y mantenimiento del módulo de **Kiosko de Autoservicio** e **Impresión Térmica Bluetooth** en OrderPoint.

## 1. Alcance y Archivos Clave
- `app/[locale]/(kiosk)/menu/page.tsx`: Pantalla principal del kiosko con selección visual de platos.
- `components/kiosk/Cart.tsx` y `CartFloatingBar.tsx`: Carrito de compras reactivo y resumen flotante.
- `components/kiosk/ProductCustomizationModal.tsx`: Modal para selección de modificadores obligatorios/opcionales e ingredientes removibles.
- `hooks/useBluetoothPrinter.ts`: Hook para la conexión y transmisión de datos a través de la Web Bluetooth API.
- `lib/escpos.ts`: Generador de buffers binarios ESC/POS (comandos de texto, alineación, negrita, corte de papel).

## 2. Invariantes Técnicas
- **Cálculo de Precios:** `totalPrice = unit_price (precio base + modificaciones) * quantity`.
- **Validación de Modificadores:** Respetar estrictamente `min_selections`, `max_selections` e `is_required` antes de habilitar el botón de agregar al carrito.
- **Hardware Bluetooth:** Mantener soporte para los UUIDs de servicios estándar (POS `000018f0`, ISSC `49535343`, SPP `00001101`) y compatibilidad con bobinas de 58mm y 80mm.
- **Diseño Congelado:** Prohibido alterar estilos, tamaños de botones táctiles o colores sin petición explícita.
