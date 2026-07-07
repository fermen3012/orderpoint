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

    // Lista de modelos optimizada para estabilidad y velocidad
    // gemini-1.5-flash es el estándar actual de producción (rápido y con buena cuota)
    // gemini-1.5-pro es un modelo más potente con servidores e instancias independientes
    const models = [
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-1.5-flash-latest',
        'gemini-1.5-pro-latest',
        'gemini-flash-latest' // Fallback final
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
