/**
 * Utilidades de formateo ESC/POS específicas para impresoras térmicas de 80mm.
 * Ancho estándar de línea: 48 caracteres (Font A: 12x24 px).
 */

// Comandos ESC/POS estándar (Codificados en Uint8Array)
export const ESC_POS_COMMANDS = {
    INIT: new Uint8Array([0x1b, 0x40]),               // Inicializar impresora
    ALIGN_LEFT: new Uint8Array([0x1b, 0x61, 0x00]),         // Alineación izquierda
    ALIGN_CENTER: new Uint8Array([0x1b, 0x61, 0x01]),       // Alineación al centro
    ALIGN_RIGHT: new Uint8Array([0x1b, 0x61, 0x02]),        // Alineación derecha
    BOLD_ON: new Uint8Array([0x1b, 0x45, 0x01]),            // Negrita activada
    BOLD_OFF: new Uint8Array([0x1b, 0x45, 0x00]),           // Negrita desactivada
    SIZE_NORMAL: new Uint8Array([0x1d, 0x21, 0x00]),        // Tamaño normal
    SIZE_HEADER: new Uint8Array([0x1d, 0x21, 0x11]),        // Doble alto y ancho (Encabezado)
    SIZE_ORDER_NUM: new Uint8Array([0x1d, 0x21, 0x22]),     // Triple tamaño (Número de pedido grande)
    FEED_LINE: new Uint8Array([0x0a]),                      // Salto de línea (\n)
    FEED_3_LINES: new Uint8Array([0x1b, 0x64, 0x03]),       // Avanzar 3 líneas
    PARTIAL_CUT: new Uint8Array([0x1d, 0x56, 0x42, 0x03]),   // Corte parcial de papel
    FULL_CUT: new Uint8Array([0x1d, 0x56, 0x00]),          // Corte total de papel
};

/**
 * Normaliza y sanitiza caracteres especiales (acentos españoles, ñ, etc.)
 * para garantizar compatibilidad universal en impresoras térmicas ESC/POS.
 */
export function sanitizeText(str: string): string {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ñ/g, 'n')
        .replace(/Ñ/g, 'N')
        .replace(/¿/g, '')
        .replace(/¡/g, '');
}

/**
 * Centra un texto para el ancho especificado (default 48 caracteres para 80mm).
 */
export function centerText(text: string, width: number = 48): string {
    const clean = sanitizeText(text);
    if (clean.length >= width) return clean.slice(0, width);
    const leftPadding = Math.floor((width - clean.length) / 2);
    const rightPadding = width - clean.length - leftPadding;
    return ' '.repeat(leftPadding) + clean + ' '.repeat(rightPadding);
}

/**
 * Genera una línea divisoria horizontal (p. ej. "------------------------------------------------").
 */
export function formatDashedLine(char: string = '-', width: number = 48): string {
    return char.repeat(width);
}

/**
 * Formatea una línea con el nombre del platillo/item a la izquierda y el precio a la derecha.
 * Si el nombre supera el espacio disponible, realiza envolvente multilínea ajustada.
 * Ejemplo (48 caracteres):
 * "1x Hamburguesa Doble Queso               $14.50"
 */
export function formatItemLine(name: string, priceStr: string, width: number = 48): string[] {
    const cleanName = sanitizeText(name);
    const cleanPrice = sanitizeText(priceStr);

    const maxNameWidth = width - cleanPrice.length - 1; // 1 espacio mínimo entre nombre y precio

    if (maxNameWidth <= 0) {
        // En caso extremo de precio larguísimo, imprime nombre en una línea y precio en la siguiente
        return [
            cleanName.slice(0, width),
            cleanPrice.padStart(width, ' '),
        ];
    }

    if (cleanName.length <= maxNameWidth) {
        const padding = width - cleanName.length - cleanPrice.length;
        return [`${cleanName}${' '.repeat(padding)}${cleanPrice}`];
    }

    // Si el nombre es más largo que el espacio disponible:
    const lines: string[] = [];
    let currentPos = 0;

    while (currentPos < cleanName.length) {
        const remainingLength = cleanName.length - currentPos;

        if (remainingLength <= maxNameWidth) {
            // Última línea del producto: alinear precio a la derecha en esta misma línea
            const lastPart = cleanName.slice(currentPos);
            const padding = width - lastPart.length - cleanPrice.length;
            lines.push(`${lastPart}${' '.repeat(padding)}${cleanPrice}`);
            break;
        } else {
            // Línea intermedia: llenar hasta maxNameWidth
            let chunk = cleanName.slice(currentPos, currentPos + maxNameWidth);
            // Intentar cortar en espacio para no dividir palabras
            const lastSpaceIndex = chunk.lastIndexOf(' ');
            if (lastSpaceIndex > 0) {
                chunk = chunk.slice(0, lastSpaceIndex);
                currentPos += lastSpaceIndex + 1;
            } else {
                currentPos += maxNameWidth;
            }
            lines.push(chunk);
        }
    }

    return lines;
}

/**
 * Estructura de datos para generar un ticket de pedido de Kiosco
 */
export interface TicketItemModifier {
    name: string;
    priceExtra?: number;
    type?: 'extra' | 'removal';
}

export interface TicketItem {
    quantity: number;
    name: string;
    price: number;
    modifiers?: TicketItemModifier[];
}

export interface KioskReceiptData {
    restaurantName: string;
    orderNumber: string | number;
    orderType: 'DINE_IN' | 'TAKE_AWAY' | string;
    createdAt?: string;
    items: TicketItem[];
    totalAmount: number;
    footerText?: string;
}

/**
 * Convierte un arreglo de cadenas y comandos a un único buffer Uint8Array listo para enviar a la impresora Bluetooth.
 */
export function buildEscPosReceipt(ticket: KioskReceiptData, width: number = 48): Uint8Array {
    const encoder = new TextEncoder();
    const buffers: Uint8Array[] = [];

    const append = (buf: Uint8Array) => buffers.push(buf);
    const appendText = (text: string) => buffers.push(encoder.encode(text + '\n'));

    // 1. Inicializar Impresora
    append(ESC_POS_COMMANDS.INIT);

    // 2. Encabezado - Nombre Restaurante (Centrado, Doble Tamaño, Negrita)
    append(ESC_POS_COMMANDS.ALIGN_CENTER);
    append(ESC_POS_COMMANDS.BOLD_ON);
    append(ESC_POS_COMMANDS.SIZE_HEADER);
    appendText(sanitizeText(ticket.restaurantName.toUpperCase()));

    // Resetear a tamaño normal
    append(ESC_POS_COMMANDS.SIZE_NORMAL);
    append(ESC_POS_COMMANDS.BOLD_OFF);

    // Fecha y Hora
    const dateStr = ticket.createdAt
        ? new Date(ticket.createdAt).toLocaleString()
        : new Date().toLocaleString();
    appendText(dateStr);

    // Línea separadora
    appendText(formatDashedLine('=', width));

    // 3. Tipo de Orden (Para Comer / Para Llevar)
    append(ESC_POS_COMMANDS.BOLD_ON);
    const typeLabel = ticket.orderType === 'DINE_IN' ? '*** PARA COMER AQUI ***' : '*** PARA LLEVAR ***';
    appendText(typeLabel);
    append(ESC_POS_COMMANDS.BOLD_OFF);

    // 4. Número de Pedido Gigante (Destacado para Cocina/Kiosco)
    appendText(formatDashedLine('-', width));
    appendText('NUMERO DE ORDEN');
    append(ESC_POS_COMMANDS.BOLD_ON);
    append(ESC_POS_COMMANDS.SIZE_ORDER_NUM);
    const orderNumPadded = `#${String(ticket.orderNumber).padStart(3, '0')}`;
    appendText(orderNumPadded);
    append(ESC_POS_COMMANDS.SIZE_NORMAL);
    append(ESC_POS_COMMANDS.BOLD_OFF);
    appendText(formatDashedLine('=', width));

    // 5. Lista de Productos (Alineado a la izquierda)
    append(ESC_POS_COMMANDS.ALIGN_LEFT);

    // Encabezado de columnas
    const colHeader = formatItemLine('CANT / PRODUCTO', 'SUBTOTAL', width)[0];
    append(ESC_POS_COMMANDS.BOLD_ON);
    appendText(colHeader);
    append(ESC_POS_COMMANDS.BOLD_OFF);
    appendText(formatDashedLine('-', width));

    // Items
    ticket.items.forEach((item) => {
        const itemTotalStr = `$${(item.price * item.quantity).toFixed(2)}`;
        const itemTitle = `${item.quantity}x ${item.name.toUpperCase()}`;
        const itemLines = formatItemLine(itemTitle, itemTotalStr, width);

        append(ESC_POS_COMMANDS.BOLD_ON);
        itemLines.forEach((line) => appendText(line));
        append(ESC_POS_COMMANDS.BOLD_OFF);

        // Modificadores / Extras / Quitar ingredientes
        if (item.modifiers && item.modifiers.length > 0) {
            item.modifiers.forEach((mod) => {
                const modPrefix = mod.type === 'removal' ? '   [SIN] ' : '   + ';
                const modText = `${modPrefix}${sanitizeText(mod.name)}`;
                const extraPriceStr = mod.priceExtra && mod.priceExtra > 0 ? `+$${mod.priceExtra.toFixed(2)}` : '';
                const modLines = formatItemLine(modText, extraPriceStr, width);
                modLines.forEach((line) => appendText(line));
            });
        }
    });

    appendText(formatDashedLine('=', width));

    // 6. Totales (Centrado / Derecha)
    append(ESC_POS_COMMANDS.ALIGN_RIGHT);
    append(ESC_POS_COMMANDS.BOLD_ON);
    append(ESC_POS_COMMANDS.SIZE_HEADER);
    const totalStr = `TOTAL: $${ticket.totalAmount.toFixed(2)}`;
    appendText(totalStr);
    append(ESC_POS_COMMANDS.SIZE_NORMAL);
    append(ESC_POS_COMMANDS.BOLD_OFF);

    // 7. Pie de Página
    append(ESC_POS_COMMANDS.ALIGN_CENTER);
    appendText(formatDashedLine('-', width));
    appendText(ticket.footerText || 'GRACIAS POR SU COMPRA');
    appendText('Powered by OrderPoint Kiosk');
    append(ESC_POS_COMMANDS.FEED_3_LINES);

    // 8. Corte de Papel
    append(ESC_POS_COMMANDS.PARTIAL_CUT);

    // Concatenar todos los buffers en un solo Uint8Array
    const totalBytes = buffers.reduce((acc, b) => acc + b.length, 0);
    const finalBuffer = new Uint8Array(totalBytes);
    let offset = 0;
    for (const b of buffers) {
        finalBuffer.set(b, offset);
        offset += b.length;
    }

    return finalBuffer;
}
