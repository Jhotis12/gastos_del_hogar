import { createClient } from 'npm:@supabase/supabase-js@2'
import { VOICE_PROMPT, parseVoiceDraft } from './parser.ts'

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY')
const MODEL = 'gemini-flash-latest'
const MAX_BYTES = 5 * 1024 * 1024
const DAILY_LIMIT = 10

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

function toBase64(buffer: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < buffer.length; i += chunk) {
    binary += String.fromCharCode(...buffer.subarray(i, i + chunk))
  }
  return btoa(binary)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return json({ error: 'No autenticado' }, 401)
    if (!GEMINI_KEY) return json({ error: 'La captura por voz no está configurada' }, 500)

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return json({ error: 'Petición inválida' }, 400)
    }

    const householdId = String(body.household_id ?? '')
    const mimeType = String(body.mime_type ?? '')
    const audioBase64 = String(body.audio_base64 ?? '').replace(
      /^data:[^;]+;base64,/,
      '',
    )
    const durationSeconds = Math.min(
      60,
      Math.max(0, Number(body.duration_seconds) || 0),
    )

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        householdId,
      )
    ) {
      return json({ error: 'Parámetros inválidos' }, 400)
    }
    if (!/^audio\/[a-z0-9.+-]+$/i.test(mimeType)) {
      return json({ error: 'Formato de audio no válido' }, 400)
    }
    if (!audioBase64) return json({ error: 'El audio está vacío' }, 400)
    if (audioBase64.length > Math.ceil((MAX_BYTES * 4) / 3) + 4) {
      return json({ error: 'El audio supera el máximo de 5 MB' }, 413)
    }

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
    if (!profile || profile.household_id !== householdId) {
      return json({ error: 'Sin permisos sobre este hogar' }, 403)
    }

    // Rate limit por usuario en 24h. La tabla no tiene políticas: solo
    // service_role la usa.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('audio_analysis_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', since)

    if ((count ?? 0) >= DAILY_LIMIT) {
      return json(
        { error: 'Límite de análisis de voz alcanzado. Intenta más tarde o registra el gasto manualmente.' },
        429,
      )
    }

    await supabase.from('audio_analysis_attempts').insert({
      user_id: user.id,
      household_id: householdId,
      duration_seconds: Math.round(durationSeconds),
    })
    void supabase.rpc('cleanup_audio_analysis_attempts')

    const bytes = Uint8Array.from(atob(audioBase64), (char) => char.charCodeAt(0))
    if (bytes.length === 0) return json({ error: 'El audio está vacío' }, 400)

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
                { text: VOICE_PROMPT },
                { inline_data: { mime_type: mimeType, data: toBase64(bytes) } },
              ],
            },
          ],
          generationConfig: { responseMimeType: 'application/json', temperature: 0 },
        }),
      },
    )

    if (!geminiRes.ok) {
      if (geminiRes.status === 429) {
        return json(
          { error: 'La IA alcanzó su límite de uso. Intenta más tarde o registra el gasto manualmente.' },
          429,
        )
      }
      console.error('analyze-expense-audio Gemini status:', geminiRes.status)
      return json({ error: 'No se pudo analizar el audio' }, 502)
    }

    const gemini = await geminiRes.json()
    const text: string = gemini?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!text) return json({ error: 'No se pudo analizar el audio' }, 422)

    const parsed = parseVoiceDraft(text)
    if ('error' in parsed) return json({ error: parsed.error }, 422)
    return json(parsed, 200)
  } catch (error) {
    // No registrar audio ni transcripciones: solo el error técnico.
    console.error('analyze-expense-audio error:', error instanceof Error ? error.message : 'unknown')
    return json({ error: 'Error interno del servidor' }, 500)
  }
})
