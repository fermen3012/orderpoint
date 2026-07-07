import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

serve(async (req) => {
  try {
    const payload = await req.json()
    const { record, table } = payload

    if (table !== 'products' || !record) {
      return new Response(JSON.stringify({ message: "Ignored: table is not products" }), { 
        status: 200, 
        headers: { "Content-Type": "application/json" } 
      })
    }

    const nameObj = record.name || { es: "", en: "" }
    const descObj = record.description || { es: "", en: "" }

    const needsName = !nameObj.en;
    const needsDesc = descObj.es && !descObj.en;

    if (!needsName && !needsDesc) {
      return new Response(JSON.stringify({ message: "Already translated" }), { 
        status: 200, 
        headers: { "Content-Type": "application/json" } 
      })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Call OpenAI
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAiApiKey) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY env variable in Supabase." }), { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      })
    }

    let translatedName = nameObj.en || ""
    let translatedDesc = descObj.en || ""

    const systemPrompt = `You are an expert bilingual menu translator. Translate the product menu content from Spanish (es) to English (en). Return ONLY the direct English translation without any quotes or explanations.`

    if (needsName && nameObj.es) {
      const nameRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openAiApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: nameObj.es }
          ],
          temperature: 0.3
        })
      });
      const nameData = await nameRes.json()
      translatedName = nameData.choices?.[0]?.message?.content?.trim() || ""
    }

    if (needsDesc && descObj.es) {
      const descRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openAiApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: descObj.es }
          ],
          temperature: 0.3
        })
      });
      const descData = await descRes.json()
      translatedDesc = descData.choices?.[0]?.message?.content?.trim() || ""
    }

    // Update row
    const { error } = await supabase
      .from('products')
      .update({
        name: { es: nameObj.es, en: translatedName },
        description: descObj.es ? { es: descObj.es, en: translatedDesc } : null
      })
      .eq('id', record.id)

    if (error) throw error

    return new Response(JSON.stringify({ success: true, name: translatedName, description: translatedDesc }), { 
      status: 200, 
      headers: { "Content-Type": "application/json" } 
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    })
  }
})
