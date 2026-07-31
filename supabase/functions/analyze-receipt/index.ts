import { createClient } from 'npm:@supabase/supabase-js@2'

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY')
const MODEL = 'gemini-flash-latest'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PROMPT = `
Eres un lector de facturas y recibos colombianos. Analiza la imagen y extrae:
- comercio: el nombre del establecimiento o tienda que aparece en la factura (si no hay, usa "Sin tienda")
- fecha: la fecha de la factura en formato YYYY-MM-DD (si no se ve, usa la fecha de hoy)
- items: la lista de productos o servicios con su descripcion, cantidad (entero, mínimo 1), valor_unitario y subtotal, todo en pesos colombianos
- total: el total de la factura en pesos colombianos

Responde SOLO con JSON válido en este formato exacto:
{"comercio": string, "fecha": string, "items": [{"descripcion": string, "cantidad": number, "valor_unitario": number, "subtotal": number}], "total": number}

Si la imagen no parece una factura o no puedes leerla, responde:
{"error": "No se pudo leer la factura. Intenta con una foto más nítida."}
`

function toBase64(buffer: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < buffer.length; i += chunk) {
    binary += String.fromCharCode(...buffer.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return json({ error: 'No autenticado' }, 401)
    if (!GEMINI_KEY) return json({ error: 'Gemini no está configurado en el servidor' }, 500)

    const { household_id, path } = await req.json()
    if (!household_id || !path) return json({ error: 'Faltan parámetros' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data: userData } = await supabase.auth.getUser(token)
    const user = userData.user
    if (!user) return json({ error: 'Sesión inválida' }, 401)

    const { data: profile } = await supabase
      .from('profiles')
      .select('household_id')
      .eq('id', user.id)
      .single()
    if (!profile || profile.household_id !== household_id) {
      return json({ error: 'Sin permisos sobre este hogar' }, 403)
    }

    const { data: file, error: dlError } = await supabase.storage
      .from('receipts')
      .download(path)
    if (dlError || !file) return json({ error: 'No se pudo leer la imagen' }, 404)

    const bytes = new Uint8Array(await file.arrayBuffer())
    const mime = file.type || 'image/jpeg'

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                { inline_data: { mime_type: mime, data: toBase64(bytes) } },
              ],
            },
          ],
          generationConfig: { responseMimeType: 'application/json', temperature: 0 },
        }),
      },
    )

    if (!geminiRes.ok) {
      const body = await geminiRes.text()
      return json({ error: `Gemini respondió con error (${geminiRes.status})` }, 502)
    }

    const gemini = await geminiRes.json()
    const text: string = gemini?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!text) return json({ error: 'No se pudo analizar la imagen' }, 422)

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return json({ error: 'El análisis no devolvió un formato válido' }, 422)
    }

    return json({ parsed }, 200)
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : 'Error interno del servidor' },
      500,
    )
  }
})
