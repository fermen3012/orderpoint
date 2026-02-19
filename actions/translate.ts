'use server';

import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function translateText(text: string, targetLanguage: string = 'es') {
    if (!text) return '';

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "Eres un traductor experto en gastronomía y menús de restaurante. Traduce el siguiente texto al español manteniendo el tono apetitoso. No traduzcas nombres propios de platos famosos (ej: 'Burger', 'Ribeye', 'Nachos') a menos que tengan un equivalente común y apetitoso. Sé conciso."
                },
                {
                    role: "user",
                    content: `Translate to ${targetLanguage}: ${text}`
                }
            ],
            temperature: 0.3,
        });

        return response.choices[0].message.content || '';
    } catch (error) {
        console.error('Translation error:', error);
        return null; // Return null to indicate failure
    }
}
