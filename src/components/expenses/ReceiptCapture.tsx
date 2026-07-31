import { useRef, useState } from 'react'
import { Camera, ImagePlus, ScanLine, X } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { useAuth } from '@/hooks/useAuth'
import { analyzeReceipt, uploadReceiptImage, useCreateReceipt, useUpdateReceiptParsed } from '@/hooks/useReceipts'
import { errorMessage } from '@/lib/utils'
import { compressImage } from '@/lib/images'
import type { Receipt, ReceiptParsed } from '@/lib/types'

interface ReceiptCaptureProps {
  open: boolean
  onClose: () => void
  onAnalyzed: (receipt: Receipt) => void
}

export default function ReceiptCapture({ open, onClose, onAnalyzed }: ReceiptCaptureProps) {
  const { user, profile } = useAuth()
  const createReceipt = useCreateReceipt()
  const updateParsed = useUpdateReceiptParsed()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setPreview(null)
    setFile(null)
    setError('')
    setAnalyzing(false)
  }

  const handleFile = (f: File | null) => {
    if (!f) return
    setFile(f)
    setError('')
    setPreview(URL.createObjectURL(f))
  }

  const analyze = async () => {
    if (!file || !profile?.household_id || !user) return
    setAnalyzing(true)
    setError('')
    try {
      const compressed = await compressImage(file)
      const path = await uploadReceiptImage(profile.household_id, compressed)
      const receiptId = await createReceipt.mutateAsync({ storage_path: path })
      const parsed: ReceiptParsed = await analyzeReceipt(profile.household_id, path)
      await updateParsed.mutateAsync({ id: receiptId, parsed })
      onAnalyzed({ id: receiptId, household_id: profile.household_id, storage_path: path, uploaded_by: user.id, parsed_data: parsed, created_at: new Date().toISOString() })
      reset()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <Modal open={open} title="Escanear factura" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-ink/50">
          Toma una foto de la factura o súbela desde tu galería. La analizaremos con
          inteligencia artificial para crear el gasto automáticamente.
        </p>

        {!preview && !analyzing && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={() => cameraRef.current?.click()}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-pine-300 bg-pine-50/50 p-6 text-pine-700 transition-colors hover:bg-pine-100/60"
            >
              <Camera size={28} />
              <span className="text-sm font-medium">Tomar foto</span>
              <span className="text-xs text-pine-600/70">Usa la cámara</span>
            </button>
            <button
              onClick={() => galleryRef.current?.click()}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gold-300 bg-gold-100/50 p-6 text-gold-700 transition-colors hover:bg-gold-200/60"
            >
              <ImagePlus size={28} />
              <span className="text-sm font-medium">Subir de galería</span>
              <span className="text-xs text-gold-600/70">Selecciona un archivo</span>
            </button>
          </div>
        )}

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          data-testid="receipt-file-camera"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          data-testid="receipt-file-gallery"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />

        {preview && !analyzing && (
          <div className="relative overflow-hidden rounded-xl border border-slate-200">
            <img src={preview} alt="Vista previa de la factura" className="max-h-72 w-full object-contain" />
            <button
              onClick={() => {
                URL.revokeObjectURL(preview)
                reset()
              }}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
              aria-label="Quitar imagen"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {analyzing && (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-pine-200 bg-pine-50/40 py-10">
            <div className="relative w-44 overflow-hidden rounded-lg border border-dashed border-pine-300 bg-white p-4 shadow-sm">
              <div className="h-2 w-3/4 rounded bg-slate-200" />
              <div className="mt-1.5 h-1.5 w-1/2 rounded bg-slate-100" />
              <div className="mt-4 space-y-2">
                <div className="h-1.5 rounded bg-slate-100" />
                <div className="h-1.5 w-5/6 rounded bg-slate-100" />
                <div className="h-1.5 w-2/3 rounded bg-slate-100" />
                <div className="h-1.5 w-3/4 rounded bg-slate-100" />
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-dashed border-slate-200 pt-3">
                <div className="h-2 w-10 rounded bg-slate-200" />
                <div className="h-2 w-12 rounded bg-pine-400/70" />
              </div>
              <div className="animate-scan-sweep absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-pine-300/40 to-pine-500/70" />
            </div>
            <p className="text-sm font-medium text-pine-700">
              Analizando factura
              <span className="animate-dot inline-block">.</span>
              <span className="animate-dot inline-block" style={{ animationDelay: '150ms' }}>.</span>
              <span className="animate-dot inline-block" style={{ animationDelay: '300ms' }}>.</span>
            </p>
            <p className="text-xs text-pine-600/60">Leyendo la imagen, un momento…</p>
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-coral-100/60 px-3 py-2 text-sm text-coral-700">{error}</p>
        )}

        {preview && !analyzing && (
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-cream"
            >
              Cancelar
            </button>
            <button
              onClick={analyze}
              className="inline-flex items-center gap-2 rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800"
            >
              <ScanLine size={16} />
              Analizar factura
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
