export type VoiceDraft = {
  amount: number
  description: string
  date: string | null
  category_hint: string | null
  payer_hint: string | null
  confidence: number
}

export function isVoiceExpenseEnabled(): boolean {
  return import.meta.env.VITE_FEATURE_VOICE_EXPENSE === 'true'
}

// FileReader agrega "data:audio/webm;codecs=opus;base64,"; atob solo acepta el base64.
export function stripDataUrl(value: string): string {
  return value.replace(/^data:[^,]*,/, '')
}
