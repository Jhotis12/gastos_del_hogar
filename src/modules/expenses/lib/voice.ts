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
