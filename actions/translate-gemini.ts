'use server';

interface TranslationResult {
    detectedLanguage: 'en' | 'es';
    en: string;
    es: string;
}

import { createClient } from '@supabase/supabase-js';

export async function generateDualTranslation(inputText: string): Promise<TranslationResult | null> {
    if (!inputText) return null;

    let apiKey = process.env.GOOGLE_GEMINI_API_KEY;

    // Load key from database settings dynamically using service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseServiceKey) {
        try {
            const adminClient = createClient(supabaseUrl, supabaseServiceKey);
            const { data } = await adminClient
                .from('system_settings')
                .select('value')
                .eq('key', 'gemini_api_key')
                .maybeSingle();

            if (data?.value) {
                apiKey = data.value;
                console.log('[Gemini Translation] Loaded gemini_api_key from system_settings.');
            }
        } catch (dbErr) {
            console.warn('[Gemini Translation] Failed to load key from settings table:', dbErr);
        }
    }

    if (!apiKey) {
        console.error('❌ Google Gemini API Key is missing.');
        throw new Error('Server misconfiguration: Missing API Key (Gemini API Key). Configúrala en la página de Configuraciones del Super Admin.');
    }

    const prompt = `
      You are an expert bilingual menu translator (English <-> Spanish).
      
      Task:
      1. Analyze the input text: "${inputText}".
      2. Detect if it's primarily English or Spanish.
      3. Generate TWO outputs:
         - "en": The text in clear, appetizing English (Title Case).
         - "es": The text in clear, appetizing Spanish (Latin American, Neutral).
      
      Rules:
      - If the input is already in English, refine it for "en" and translate for "es".
      - If the input is in Spanish, refine it for "es" and translate for "en".
      - Keep proper nouns (like 'Ribeye', 'Coca-Cola', 'Burger') unchanged unless there is a common equivalent.
      - Make it sound appetizing and commercial.
      
      Output Format (JSON only):
      {
        "detectedLanguage": "en" or "es",
        "en": "...",
        "es": "..."
      }
    `;

    // Lista de modelos optimizada para estabilidad y velocidad en primer intento
    const models = [
        'gemini-flash-latest',
        'gemini-3.8-flash',
        'gemini-3.7-flash',
        'gemini-pro-latest',
        'gemini-2.5-flash'
    ];

    const payload = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }],
        generationConfig: {
            response_mime_type: "application/json"
        }
    };

    let lastError = null;

    for (const model of models) {
        try {
            console.log(`[Gemini Dual] Attempting with model: ${model}`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.warn(`[Gemini Dual] Model ${model} failed:`, errorData.error?.message || response.statusText);
                lastError = errorData.error?.message || response.statusText;
                continue; // Prueba el siguiente modelo
            }

            const data = await response.json();
            const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!responseText) {
                lastError = 'No content returned from Gemini';
                continue;
            }

            // Parseamos el JSON
            try {
                const result = JSON.parse(responseText);
                console.log(`[Gemini Dual] Success with ${model}`);
                return result;
            } catch (parseError) {
                console.error('JSON Parse Error:', parseError);
                lastError = 'Invalid JSON response from AI';
                continue;
            }

        } catch (error: any) {
            console.error(`[Gemini Dual] Network Error on ${model}:`, error);
            lastError = error.message;
        }
    }

    throw new Error(`All translation models failed. Last error: ${lastError}`);
}

export interface ScannedMenuDish {
    nombre_es: string;
    nombre_en: string;
    descripcion_es: string;
    descripcion_en: string;
    precio: string;
    categoria: string;
}

export interface MenuImagePayload {
    mimeType: string;
    base64Data: string;
}

export async function extractMenuFromImagesWithGemini(
    images: MenuImagePayload[]
): Promise<{ success: boolean; dishes: ScannedMenuDish[]; error?: string }> {
    if (!images || images.length === 0) {
        return { success: false, dishes: [], error: 'No se recibieron imágenes para analizar.' };
    }

    let apiKey = process.env.GOOGLE_GEMINI_API_KEY;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseServiceKey) {
        try {
            const adminClient = createClient(supabaseUrl, supabaseServiceKey);
            const { data } = await adminClient
                .from('system_settings')
                .select('value')
                .eq('key', 'gemini_api_key')
                .maybeSingle();

            if (data?.value) {
                apiKey = data.value;
            }
        } catch (dbErr) {
            console.warn('[Gemini Menu Scanner] Failed to load key from settings table:', dbErr);
        }
    }

    if (!apiKey) {
        return {
            success: false,
            dishes: [],
            error: 'Falta la clave de API de Google Gemini. Configúrala en la página de Configuraciones del Super Admin.'
        };
    }

    const prompt = `
      You are an expert restaurant menu digitizer and bilingual culinary translator (Spanish <-> English).

      Task:
      Analyze the provided physical or digital restaurant menu photo(s) and extract EVERY dish, food item, combo, side, dessert, and beverage into a structured list ready for CSV import.

      Strict Rules:
      1. Extract ALL menu items visible across the image(s). Ignore non-menu information such as phone numbers, addresses, social media, hours, tips, or legal disclaimers.
      2. For EVERY item, provide all 6 required fields:
         - "nombre_es": Dish name in clear, appetizing Latin American Spanish. (If the menu is in English, translate it accurately while keeping proper culinary names like 'Ribeye' or 'Burger' natural).
         - "nombre_en": Dish name in clear, appetizing English (Title Case). (If the menu is in Spanish, translate it accurately to English).
         - "descripcion_es": Appetizing culinary description in Spanish (1 concise sentence, max 130 characters). If the menu photo already has a description, use/refine it. If the menu photo does NOT have a description for the dish, write a concise, accurate, appetizing culinary description in Spanish based on the dish name and category.
         - "descripcion_en": Appetizing culinary description in English matching "descripcion_es" (1 concise sentence, max 130 characters).
         - "precio": Numeric price formatted with 2 decimals (e.g. "3.50", "12.99"). Remove any currency symbols ($, USD, etc.) or text. If an item has no visible price, use "0.00".
         - "categoria": Category name in Spanish (Title Case, e.g., "Tacos", "Entradas", "Hamburguesas", "Platos Fuertes", "Bebidas", "Postres"). Use the section headers from the menu photo or infer the logical category.
      3. Do not use line breaks inside fields. Keep texts clean for CSV export.

      Output Format (Strict JSON only):
      {
        "dishes": [
          {
            "nombre_es": "Tacos al Pastor",
            "nombre_en": "Pastor Tacos",
            "descripcion_es": "Tres deliciosos tacos de cerdo marinado con piña y cilantro fresco",
            "descripcion_en": "Three delicious marinated pork tacos with pineapple and fresh cilantro",
            "precio": "3.50",
            "categoria": "Tacos"
          }
        ]
      }
    `;

    const imageParts = images.map(img => ({
        inline_data: {
            mime_type: img.mimeType || 'image/jpeg',
            data: img.base64Data.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '')
        }
    }));

    const payload = {
        contents: [
            {
                parts: [
                    { text: prompt },
                    ...imageParts
                ]
            }
        ],
        generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.2
        }
    };

    const models = [
        'gemini-flash-latest',
        'gemini-3.8-flash',
        'gemini-3.7-flash',
        'gemini-pro-latest',
        'gemini-2.5-flash'
    ];

    let lastError = 'Unknown error';

    for (const model of models) {
        try {
            console.log(`[Gemini Menu Scanner] Attempting menu OCR with model: ${model}`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.warn(`[Gemini Menu Scanner] Model ${model} failed:`, errorData.error?.message || response.statusText);
                lastError = errorData.error?.message || response.statusText;
                continue;
            }

            const data = await response.json();
            const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!responseText) {
                lastError = 'No content returned from Gemini Vision';
                continue;
            }

            const cleanedJson = responseText
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/\s*```$/i, '')
                .trim();

            const parsed = JSON.parse(cleanedJson);
            const rawList = Array.isArray(parsed) ? parsed : (parsed.dishes || parsed.items || parsed.menu || []);

            if (!Array.isArray(rawList)) {
                lastError = 'Unexpected JSON structure from AI';
                continue;
            }

            const normalizedDishes: ScannedMenuDish[] = rawList
                .map((item: any) => {
                    const rawPrice = String(item.precio ?? item.price ?? '0')
                        .replace(/[^0-9.,]/g, '')
                        .replace(',', '.');
                    const numPrice = parseFloat(rawPrice);
                    const formattedPrice = !isNaN(numPrice) && numPrice >= 0 ? numPrice.toFixed(2) : '0.00';

                    return {
                        nombre_es: String(item.nombre_es || item.name_es || item.name || '').trim(),
                        nombre_en: String(item.nombre_en || item.name_en || item.nombre_es || '').trim(),
                        descripcion_es: String(item.descripcion_es || item.description_es || '').replace(/\r?\n|\r/g, ' ').trim(),
                        descripcion_en: String(item.descripcion_en || item.description_en || '').replace(/\r?\n|\r/g, ' ').trim(),
                        precio: formattedPrice,
                        categoria: String(item.categoria || item.category || 'General').trim() || 'General'
                    };
                })
                .filter((d: ScannedMenuDish) => d.nombre_es.length > 0 || d.nombre_en.length > 0);

            console.log(`[Gemini Menu Scanner] Extracted ${normalizedDishes.length} dishes with ${model}`);
            return {
                success: true,
                dishes: normalizedDishes
            };
        } catch (err: any) {
            console.error(`[Gemini Menu Scanner] Error on ${model}:`, err);
            lastError = err.message || 'Network/Parse error';
        }
    }

    return {
        success: false,
        dishes: [],
        error: `No se pudo procesar el menú con IA. Detalle: ${lastError}`
    };
}

