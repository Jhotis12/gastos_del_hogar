import { useEffect, useRef, useState } from 'react'
import { Mic, Square, X } from 'lucide-react'
import Modal from '@/shared/components/ui/Modal'
import { useAuth } from '@/shared/hooks/useAuth'
import { supabase } from '@/shared/lib/supabase'
import { errorMessage } from '@/shared/lib/utils'
import type { VoiceDraft } from '@/modules/expenses/lib/voice'

const CONSENT_KEY = 'voice-expense-consent'
const MAX_SECONDS = 30

type Phase = 'consent' | 'idle' | 'recording' | 'analyzing' | 'error'

type Props = {
  open: boolean
  onClose: () => void
  onDraft: (draft: VoiceDraft) => void
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      resolve(result.replace(/^data:[^;]+;base64,/, ''))
    }
    reader.onerror = () => reject(new Error('No se pudo leer el audio'))
    reader.readAsDataURL(blob)
  })
}

export default function VoiceExpenseModal({ open, onClose, onDraft }: Props) {
  const { profile } = useAuth()
  const [phase, setPhase] = useState<Phase>('consent')
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const secondsRef = useRef(0)
  const cancelledRef = useRef(false)

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
  }

  useEffect(() => {
    if (!open) return
    cancelledRef.current = false
    setSeconds(0)
    secondsRef.current = 0
    setError('')
    setPhase(localStorage.getItem(CONSENT_KEY) === '1' ? 'idle' : 'consent')
    return () => {
      cancelledRef.current = true
      cleanup()
    }
  }, [open])

  const analyze = async (blob: Blob) => {
    if (!profile?.household_id) {
      setError('No hay un hogar activo')
      setPhase('error')
      return
    }
    if (!navigator.onLine) {
      setError('La captura por voz requiere conexión. Puedes registrar el gasto manualmente.')
      setPhase('error')
      return
    }

    setPhase('analyzing')
    try {
      const audioBase64 = await blobToBase64(blob)
      const invoke = supabase.functions.invoke('analyze-expense-audio', {
        body: {
          household_id: profile.household_id,
          audio_base64: audioBase64,
          mime_type: blob.type || 'audio/webm',
          duration_seconds: secondsRef.current,
        },
      })
      const { data, error: invokeError } = await Promise.race([
        invoke,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('El análisis tardó demasiado')), 30000),
        ),
      ])
      if (invokeError) throw invokeError
      const payload = data as { error?: string; draft?: VoiceDraft } | null
      if (payload?.error) throw new Error(payload.error)
      if (!payload?.draft) throw new Error('El análisis no devolvió un borrador')
      onDraft(payload.draft)
      onClose()
    } catch (err) {
      setError(
        errorMessage(err) ||
          'No se pudo analizar el audio. Intenta de nuevo o registra el gasto manualmente.',
      )
      setPhase('error')
    }
  }

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
  }

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Este navegador no permite grabar audio. Usa el formulario manual.')
      setPhase('error')
      return
    }
    if (!navigator.onLine) {
      setError('La captura por voz requiere conexión. Usa el formulario manual.')
      setPhase('error')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : undefined
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder
      chunksRef.current = []
      cancelledRef.current = false
      setSeconds(0)
      secondsRef.current = 0

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })
        cleanup()
        if (cancelledRef.current) return
        if (blob.size === 0) {
          setError('No se grabó audio. Intenta de nuevo.')
          setPhase('error')
          return
        }
        void analyze(blob)
      }

      recorder.start()
      setPhase('recording')
      timerRef.current = setInterval(() => {
        secondsRef.current += 1
        setSeconds(secondsRef.current)
        if (secondsRef.current >= MAX_SECONDS) stopRecording()
      }, 1000)
    } catch (err) {
      cleanup()
      setError(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'No hay permiso para usar el micrófono. Habilítalo en el navegador o usa el formulario manual.'
          : 'No se pudo iniciar la grabación. Usa el formulario manual.',
      )
      setPhase('error')
    }
  }

  const cancel = () => {
    cancelledRef.current = true
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    cleanup()
    onClose()
  }

  return (
    <Modal open={open} title="Dictar un gasto" onClose={cancel}>
      <div className="space-y-5">
        {phase === 'consent' && (
          <>
            <p className="text-sm leading-relaxed text-ink/60">
              El audio se envía a Gemini para extraer el monto y la descripción.
              No se guarda en la app ni en Storage, y no se registra ningún
              gasto hasta que revises y confirmes el formulario.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(CONSENT_KEY, '1')
                  setPhase('idle')
                }}
                className="min-h-11 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-cream"
              >
                Aceptar y grabar
              </button>
              <button
                type="button"
                onClick={cancel}
                className="min-h-11 rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800"
              >
                Usar el formulario
              </button>
            </div>
          </>
        )}

        {phase === 'idle' && (
          <>
            <p className="text-sm text-ink/60">
              Di algo como “gasté cincuenta mil en el mercado de ayer”. Tienes
              hasta 30 segundos.
            </p>
            <button
              type="button"
              onClick={() => void startRecording()}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-pine-700 text-sm font-semibold text-white hover:bg-pine-800"
            >
              <Mic size={20} />
              Empezar a grabar
            </button>
          </>
        )}

        {phase === 'recording' && (
          <>
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-pine-50 p-5 text-pine-700">
              <span className="flex h-14 w-14 animate-pulse items-center justify-center rounded-full bg-pine-600 text-white">
                <Mic size={24} />
              </span>
              <p className="font-display text-2xl font-bold tabular-nums">
                {String(Math.floor(seconds / 60)).padStart(2, '0')}:
                {String(seconds % 60).padStart(2, '0')}
              </p>
              <p className="text-xs text-pine-600/70" aria-live="polite">
                Grabando… toca Detener al terminar.
              </p>
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-ink text-sm font-semibold text-cream hover:bg-ink/90"
            >
              <Square size={18} />
              Detener y analizar
            </button>
            <button
              type="button"
              onClick={cancel}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg text-sm text-ink/55 hover:bg-cream"
            >
              <X size={16} />
              Cancelar
            </button>
          </>
        )}

        {phase === 'analyzing' && (
          <div className="rounded-2xl bg-cream p-5 text-center">
            <p className="font-medium text-ink">Analizando el audio…</p>
            <p className="mt-1 text-sm text-ink/50">
              Esto puede tardar unos segundos.
            </p>
          </div>
        )}

        {phase === 'error' && (
          <>
            <p role="alert" className="rounded-lg bg-coral-100/60 px-3 py-2 text-sm text-coral-600">
              {error}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setError('')
                  setPhase('idle')
                }}
                className="min-h-11 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-cream"
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={cancel}
                className="min-h-11 rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800"
              >
                Usar el formulario
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
