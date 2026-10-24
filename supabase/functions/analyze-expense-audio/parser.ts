export type VoiceDraft = {
  amount: number
  description: string
  date: string | null
  category_hint: string | null
  payer_hint: string | null
  confidence: number
}

export type ParsedVoiceDraft = { draft: VoiceDraft } | { error: string }

// MediaRecorder agrega ";codecs=opus" al MIME; Gemini solo acepta el tipo base.
export function normalizeAudioMimeType(value: string): string | null {
  const base = value.split(';')[0]?.trim().toLowerCase() ?? ''
  return /^audio\/[a-z0-9.+-]+$/.test(base) ? base : null
}

// Clientes viejos envían el data URL completo; atob solo acepta el base64.
export function normalizeAudioBase64(value: string): string {
  return value.replace(/^data:[^,]*,/, '')
}

export const VOICE_PROMPT = `
Eres un asistente que convierte una nota de voz de un gasto colombiano en un
borrador estructurado. Escucha el audio y extrae:
- amount: el monto en pesos colombianos (número entero; "50 mil" = 50000)
- description: una descripción breve del gasto (ej. "Mercado")
- date: la fecha del gasto en YYYY-MM-DD (si no se menciona, null)
- category_hint: una categoría probable (Comida, Transporte, Salud, Ocio,
  Servicios, Vivienda, Otros) o null
- payer_hint: quién pagó si se menciona un nombre o "yo" (string o null)
- confidence: confianza entre 0 y 1

Responde SOLO con JSON válido:
{"amount": number, "description": string, "date": string|null, "category_hint": string|null, "payer_hint": string|null, "confidence": number}

Si el audio está vacío, no se entiende o no contiene un gasto, responde:
{"error": "No pude entender el gasto. Intenta de nuevo o regístralo manualmente."}
`

function isDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

// Validación compartida entre la Edge Function y las pruebas con Gemini mockeado.
export function parseVoiceDraft(text: string): ParsedVoiceDraft {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { error: 'El análisis no devolvió un formato válido' }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { error: 'El análisis no devolvió un formato válido' }
  }

  const data = parsed as Record<string, unknown>
  if (typeof data.error === 'string' && data.error.trim()) {
    return { error: data.error }
  }

  const amount = Number(data.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'No pude entender el monto del gasto' }
  }

  const description =
    typeof data.description === 'string' ? data.description.trim() : ''
  if (!description) {
    return { error: 'No pude entender la descripción del gasto' }
  }

  const confidence = Number(data.confidence)
  return {
    draft: {
      amount: Math.round(amount),
      description,
      date: isDate(data.date) ? data.date : null,
      category_hint:
        typeof data.category_hint === 'string'
          ? data.category_hint.trim() || null
          : null,
      payer_hint:
        typeof data.payer_hint === 'string'
          ? data.payer_hint.trim() || null
          : null,
      confidence: Number.isFinite(confidence)
        ? Math.min(1, Math.max(0, confidence))
        : 0,
    },
  }
}
