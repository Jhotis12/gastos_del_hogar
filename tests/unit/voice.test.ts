import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  normalizeAudioBase64,
  normalizeAudioMimeType,
  parseVoiceDraft,
} from '../../supabase/functions/analyze-expense-audio/parser.ts'
import { stripDataUrl } from '../../src/modules/expenses/lib/voice.ts'

test('parseVoiceDraft acepta un borrador válido y normaliza', () => {
  assert.deepEqual(
    parseVoiceDraft(
      JSON.stringify({
        amount: 50000.4,
        description: '  Mercado de voz  ',
        date: '2026-10-24',
        category_hint: 'Comida',
        payer_hint: 'yo',
        confidence: 1.4,
      }),
    ),
    {
      draft: {
        amount: 50000,
        description: 'Mercado de voz',
        date: '2026-10-24',
        category_hint: 'Comida',
        payer_hint: 'yo',
        confidence: 1,
      },
    },
  )
})

test('parseVoiceDraft rechaza audio sin monto y errores de la IA', () => {
  assert.deepEqual(parseVoiceDraft('{"description":"algo"}'), {
    error: 'No pude entender el monto del gasto',
  })
  assert.deepEqual(
    parseVoiceDraft('{"error":"No pude entender el gasto."}'),
    { error: 'No pude entender el gasto.' },
  )
  assert.deepEqual(parseVoiceDraft('no es json'), {
    error: 'El análisis no devolvió un formato válido',
  })
})

test('parseVoiceDraft deja fecha inválida en null', () => {
  const parsed = parseVoiceDraft(
    '{"amount":1000,"description":"Café","date":"ayer","confidence":0.5}',
  )
  assert.ok('draft' in parsed)
  assert.equal(parsed.draft.date, null)
})

test('normalizeAudioMimeType quita los codecs de MediaRecorder', () => {
  assert.equal(normalizeAudioMimeType('audio/webm;codecs=opus'), 'audio/webm')
  assert.equal(normalizeAudioMimeType('audio/ogg; codecs=opus'), 'audio/ogg')
  assert.equal(normalizeAudioMimeType('AUDIO/WEBM'), 'audio/webm')
  assert.equal(normalizeAudioMimeType('video/webm'), null)
  assert.equal(normalizeAudioMimeType(''), null)
})

test('normalizeAudioBase64 quita el data URL con codecs', () => {
  assert.equal(
    normalizeAudioBase64('data:audio/webm;codecs=opus;base64,AAAA'),
    'AAAA',
  )
  assert.equal(normalizeAudioBase64('data:audio/webm;base64,AAAA'), 'AAAA')
  assert.equal(normalizeAudioBase64('AAAA'), 'AAAA')
})

test('stripDataUrl del cliente quita el prefijo con codecs', () => {
  assert.equal(
    stripDataUrl('data:audio/webm;codecs=opus;base64,AAAA'),
    'AAAA',
  )
})

test('el fixture de audio existe y no está vacío', () => {
  const audio = readFileSync(new URL('../fixtures/gasto-voz.webm', import.meta.url))
  assert.ok(audio.byteLength > 100)
})
