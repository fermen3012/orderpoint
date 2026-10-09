# 🎨 OrderPoint Design System Specification (Tailwind CSS)

> **Documento técnico de diseño UI/UX para IA & Desarrolladores Frontend.**  
> Este documento contiene **únicamente directivas visuales, diseño, paletas de colores, geometrías, sombras, efectos de resplandor (glow), tipografía y animaciones**, sin lógica de negocio, listo para replicarse en cualquier aplicación React, Next.js, Vue o Vite con Tailwind CSS.

---

## 1. Filosofía Estética Core: *Dark Cyber-Gastronomy & High-Contrast Glassmorphism*

El diseño de la aplicación se caracteriza por:
1. **Fondos Ultra-Oscuros Profundos:** Base en `slate-950` y `slate-900` para maximizar el contraste y reducir la fatiga visual en entornos de restaurante (cocina con poca luz, salón o quioscos táctiles).
2. **Glassmorphism Translúcido:** Contenedores con `backdrop-blur-md` o `backdrop-blur-xl` y bordes sutiles `border-slate-800` que dan profundidad tridimensional sin sobrecargar.
3. **Resplandores de Luz Neon (Ambient Glow):** Orbes de luz desenfocados (`blur-2xl` y `blur-3xl`) que emergen detrás de tarjetas y botones clave.
4. **Geometría Orgánica Ultra-Redondeada:** Bordes curvados pronunciados (`rounded-[32px]`, `rounded-[2.5rem]`, `rounded-[3rem]`) que hacen que la interfaz se sienta moderna, táctil y amigable.
5. **Tipografía de Alto Impacto Gastronómico:** Mayúsculas con renderizado `font-black italic tracking-tighter uppercase`.
6. **Microinteracciones Hápticas:** Estados activos `active:scale-95` o `active:scale-90` que otorgan una sensación de clic mecánico físico.

---

## 2. Paleta de Colores (Tokens de Color)

### 2.1 Superficies y Fondos Base
```css
/* Fondos de pantalla y contenedores */
--bg-canvas:        #020617; /* bg-slate-955 / bg-slate-950 */
--bg-surface-card:  rgba(15, 23, 42, 0.40); /* bg-slate-900/40 con backdrop-blur-md */
--bg-surface-hover: rgba(30, 41, 59, 0.60); /* bg-slate-800/60 */
--border-subtle:    rgba(30, 41, 59, 0.80); /* border-slate-800/80 */
--border-highlight: rgba(51, 65, 85, 0.50); /* border-slate-700/50 */
```

### 2.2 Acentos Primarios y Estados
| Rol / Estado | Color Base | Clases Tailwind Clave | Efecto Glow / Sombra |
| :--- | :--- | :--- | :--- |
| **Primary (Éxito / Neon)** | Emerald (`#10b981`) | `bg-emerald-500`, `text-emerald-400`, `border-emerald-500/80` | `shadow-[0_0_25px_rgba(16,185,129,0.35)]` |
| **Warning (Alerta / Kiosko)** | Amber (`#f59e0b`) | `bg-amber-500`, `text-amber-400`, `border-amber-500/40` | `shadow-[0_0_20px_rgba(245,158,11,0.30)]` |
| **Danger (Borrar / Ocupado)** | Rose/Red (`#ef4444`) | `bg-red-500`, `text-red-400`, `border-red-500/80` | `shadow-[0_0_25px_rgba(239,68,68,0.35)]` |
| **Accent (Personal / Salón)** | Indigo/Purple (`#6366f1`) | `bg-indigo-500`, `text-indigo-300`, `border-indigo-500/40` | `shadow-[0_0_20px_rgba(99,102,241,0.30)]` |
| **Neutral / Muted** | Slate (`#64748b`) | `text-slate-400`, `text-slate-500`, `bg-slate-800` | N/A |

---

## 3. Tipografía y Estilo de Texto

### 3.1 Título Hero de Sección
```html
<div class="flex items-center gap-2 mb-2">
    <span class="w-8 h-1 bg-emerald-500 rounded-full"></span>
    <span class="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">OPERACIONES</span>
</div>
<h1 class="text-4xl lg:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
    TITULO PRINCIPAL
</h1>
<p class="text-slate-400 font-bold mt-3 text-[10px] uppercase tracking-widest">
    DESCRIPCIÓN O SUBTÍTULO INFORMATIVO
</p>
```

### 3.2 Números Destacados / Badges de Precio
```html
<!-- Número de orden, mesa o métrica -->
<span class="text-3xl sm:text-4xl font-black italic tracking-tighter text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
    #12
</span>

<!-- Precios / Montos -->
<span class="text-2xl font-black text-emerald-400 italic tracking-tighter">
    $24.50
</span>
```

### 3.3 Micro-Etiquetas y Badges
```html
<!-- Pastilla esmeralda (disponible / listo) -->
<span class="text-[10px] uppercase font-black tracking-widest text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-500/40 shadow-sm">
    ACTIVO
</span>

<!-- Pastilla ámbar (pendiente / kiosko) -->
<span class="text-[10px] uppercase font-black tracking-widest text-amber-400 bg-amber-950/80 px-3 py-1 rounded-full border border-amber-500/40 shadow-sm">
    PENDIENTE
</span>

<!-- Pastilla roja (ocupado / urgente) -->
<span class="text-[10px] uppercase font-black tracking-widest text-red-400 bg-red-950/80 px-3 py-1 rounded-full border border-red-500/40 shadow-sm">
    OCUPADO
</span>
```

---

## 4. Componentes y Botones

### 4.1 Botón Primario Hero (Llamada a la Acción Principal)
Ideal para "+ NUEVO REGISTRO", "CREAR", "CONFIRMAR PEDIDO":
```html
<button class="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-[0_8px_25px_rgba(16,185,129,0.35)] hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-3">
    <!-- Icono Lucide con stroke grueso -->
    <svg class="w-4 h-4 stroke-[3px]" ...></svg>
    <span>NUEVA ACCIÓN</span>
</button>
```

### 4.2 Botón Secundario / Outline Dark
Ideal para "ACTUALIZAR", "CANCELAR", "DESCARGAR":
```html
<button class="px-6 py-4 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg flex items-center gap-2">
    <span>ACTUALIZAR</span>
</button>
```

### 4.3 Botón de Peligro / Borrado (Danger Action)
```html
<button class="py-4 px-6 bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-[0_8px_25px_rgba(239,68,68,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2">
    <span>ELIMINAR REGISTRO</span>
</button>
```

### 4.4 Botones Cuadrados de Acción Rápida (Floating Tooltips)
Botones pequeños situados en esquinas de tarjetas:
```html
<!-- Editar -->
<button class="p-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-all active:scale-90 shadow-md">
    <svg class="w-3.5 h-3.5" ...></svg>
</button>

<!-- Borrar -->
<button class="p-2.5 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-400 hover:text-red-300 border border-red-500/40 transition-all active:scale-90 shadow-md shadow-red-950/50">
    <svg class="w-3.5 h-3.5" ...></svg>
</button>
```

---

## 5. Tarjetas y Grids

### 5.1 Tarjeta Cuadrada Hero (Estilo Mesa / Plato Exo Server)
La pieza central del diseño. Aspecto 1:1, halo de luz, borde degradado y elevación táctil:
```html
<div class="aspect-square p-5 rounded-[32px] border-2 border-emerald-500/80 bg-gradient-to-br from-emerald-950/50 via-slate-900 to-teal-950/60 shadow-[0_0_25px_rgba(16,185,129,0.35)] hover:shadow-[0_0_35px_rgba(16,185,129,0.55)] hover:border-emerald-400 transition-all duration-300 relative overflow-hidden group flex flex-col items-center justify-between">
    
    <!-- Ambient Glow Highlight (Desenfoque de fondo) -->
    <div class="absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl pointer-events-none bg-emerald-500/25 group-hover:bg-emerald-500/35 transition-all"></div>

    <!-- Fila Superior: Icono y Botones -->
    <div class="w-full flex items-center justify-between relative z-10">
        <div class="w-11 h-11 rounded-2xl flex items-center justify-center bg-gradient-to-tr from-emerald-600 to-teal-400 shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-transform group-hover:scale-105 text-white">
            <svg class="w-5 h-5" ...></svg>
        </div>
        <div class="flex items-center gap-1.5">
            <!-- Botones de acción aquí -->
        </div>
    </div>

    <!-- Centro: Número / Título -->
    <div class="text-center relative z-10 my-auto">
        <span class="block text-3xl sm:text-4xl font-black italic tracking-tighter leading-none text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
            #05
        </span>
    </div>

    <!-- Fila Inferior: Pastilla Informativa -->
    <div class="w-full text-center relative z-10">
        <span class="inline-flex items-center justify-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-emerald-300 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-500/40 shadow-sm">
            4 PERSONAS
        </span>
    </div>
</div>
```

### 5.2 Tarjetas Rectangulares de Métricas (Dashboard StatCard)
```html
<div class="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[3rem] border border-slate-800 hover:border-slate-700 transition-all group">
    <div class="flex justify-between items-start mb-6">
        <div class="p-4 rounded-2xl bg-emerald-500 text-slate-900 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6">
            <svg class="w-6 h-6" ...></svg>
        </div>
        <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            18 PEDIDOS HOY
        </span>
    </div>
    <p class="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1 italic">
        VENTAS DE HOY
    </p>
    <h3 class="text-3xl font-black text-white tracking-tighter">
        $1,420.50
    </h3>
</div>
```

---

## 6. Modales y Ventanas Emergentes (Dialogs)

### 6.1 Modal de Confirmación de Borrado con Resplandor Rojo
```html
<!-- Backdrop -->
<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/85 backdrop-blur-md animate-in fade-in duration-200">
    
    <!-- Modal Card -->
    <div class="bg-slate-900 w-full max-w-md rounded-[32px] border border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.2)] p-8 relative overflow-hidden animate-in zoom-in-95 duration-200">
        
        <!-- Ambient Glow Rojo -->
        <div class="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl bg-red-500/20 pointer-events-none"></div>

        <!-- Icono de Advertencia Centrado con Gradiente -->
        <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-400 shadow-[0_0_20px_rgba(239,68,68,0.5)] flex items-center justify-center mx-auto mb-5 text-white">
            <svg class="w-8 h-8 stroke-[2.5px]" ...></svg>
        </div>

        <!-- Título -->
        <h3 class="text-2xl font-black text-white italic tracking-tighter uppercase text-center">
            ¿ESTÁS SEGURO DE BORRAR?
        </h3>

        <!-- Descripción -->
        <p class="text-slate-300 text-xs font-bold text-center mt-3 leading-relaxed">
            Esta acción eliminará el elemento de forma permanente. El historial permanecerá intacto.
        </p>

        <!-- Botones Gemelos -->
        <div class="flex items-center gap-3 mt-8">
            <button class="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 border border-slate-700/80">
                CANCELAR
            </button>
            <button class="flex-1 py-4 bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-[0_8px_25px_rgba(239,68,68,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2">
                SÍ, BORRAR
            </button>
        </div>
    </div>
</div>
```

### 6.2 Modal de Formulario (Creación / Edición)
```html
<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
    <div class="bg-slate-900 w-full max-w-md rounded-[32px] border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative">
        
        <!-- Header -->
        <div class="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-955">
            <h2 class="text-2xl font-black text-white italic tracking-tighter uppercase">
                EDITAR ELEMENTO
            </h2>
            <button class="p-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-2xl transition-all border border-slate-800">
                ✕
            </button>
        </div>

        <!-- Formulario -->
        <form class="p-8 space-y-6">
            <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                    NOMBRE O NÚMERO
                </label>
                <input type="text" class="w-full px-5 py-4 bg-slate-955 border border-slate-800 rounded-2xl focus:border-emerald-500 outline-none transition-all font-black text-white text-sm" />
            </div>

            <button type="submit" class="w-full py-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl font-black uppercase tracking-widest shadow-[0_8px_25px_rgba(16,185,129,0.35)] hover:-translate-y-0.5 transition-all active:scale-95">
                GUARDAR CAMBIOS
            </button>
        </form>
    </div>
</div>
```

---

## 7. Controles de Entrada (Inputs, Selects, Search)

### 7.1 Barra de Búsqueda con Icono Integrado
```html
<div class="relative group">
    <svg class="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-500 transition-colors" ...></svg>
    <input
        type="text"
        placeholder="BUSCAR ELEMENTO..."
        class="w-full pl-12 pr-4 py-3.5 bg-slate-955 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-white text-[10px] uppercase tracking-wider"
    />
</div>
```

### 7.2 Selector Dropdown Estilizado
```html
<select class="w-full px-5 py-3.5 bg-slate-955 border border-slate-800 rounded-2xl focus:border-emerald-500 outline-none transition-all font-black text-white text-[10px] uppercase tracking-wider cursor-pointer">
    <option value="all">TODAS LAS CATEGORÍAS</option>
    <option value="active">ACTIVAS</option>
</select>
```

### 7.3 Selector de Pastillas de Fecha / Filtro Rápido (Pills Bar)
```html
<div class="flex flex-wrap items-center gap-2">
    <!-- Pastilla Activa -->
    <button class="px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20">
        HOY
    </button>
    <!-- Pastilla Inactiva -->
    <button class="px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider bg-slate-955 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700">
        ESTE MES
    </button>
</div>
```

---

## 8. Grids Responsivos y Ergonomía Táctil

### 8.1 Breakpoints para Cuadrículas Táctiles
- **Móviles pequeños (360px - 640px):** `grid-cols-2 gap-4` (2 columnas cuadradas por pantalla táctil).
- **Tablets (640px - 1024px):** `grid-cols-3 gap-5`.
- **Laptops / KDS (1024px - 1280px):** `grid-cols-4 gap-6`.
- **Monitores Kiosko / Desktop (1280px+):** `grid-cols-5 gap-6`.

### 8.2 Dimensiones Mínimas de Toque (Touch Targets)
- Los botones principales y tarjetas nunca miden menos de `48px x 48px`.
- Padding mínimo de botones táctiles: `py-4 px-6`.
- Espaciado entre elementos clicables adyacentes: mínimo `gap-2` (8px).

---

## 9. Animaciones y Clases de Tailwind Recomendadas

```json
{
  "transiciones": "transition-all duration-300 ease-out",
  "hover": "hover:-translate-y-1 hover:shadow-2xl",
  "active_click": "active:scale-95 active:duration-75",
  "entrada_modal": "animate-in fade-in zoom-in-95 duration-200",
  "glow_ambient": "blur-2xl pointer-events-none rounded-full",
  "curvaturas_maestras": "rounded-[32px] o rounded-[2.5rem]"
}
```

---
*Este documento fue generado como referencia oficial del lenguaje visual de OrderPoint.*
