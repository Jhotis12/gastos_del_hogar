import { useEffect, useState } from 'react'
import { Maximize2, Store, X } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Skeleton from '@/components/ui/Skeleton'
import { useReceiptSignedUrl } from '@/hooks/useReceipts'
import { cn } from '@/lib/utils'
import type { ExpenseWithRelations } from '@/lib/types'
import { formatCurrency } from '@/lib/money'

interface ReceiptViewerProps {
  expense: ExpenseWithRelations | null
  onClose: () => void
}

export default function ReceiptViewer({ expense, onClose }: ReceiptViewerProps) {
  const receipt = expense?.receipt ?? null
  const { data: imageUrl } = useReceiptSignedUrl(receipt?.storage_path ?? null)
  const [fullscreen, setFullscreen] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  useEffect(() => {
    setImgLoaded(false)
  }, [imageUrl])

  useEffect(() => {
    if (!fullscreen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [fullscreen])

  const items = receipt?.parsed_data.items ?? []
  const itemsTotal = items.reduce((s, i) => s + Number(i.subtotal ?? 0), 0)

  return (
    <Modal
      open={!!expense}
      title={expense ? `Factura · ${expense.description}` : ''}
      onClose={onClose}
    >
      {expense && receipt && (
        <div className="space-y-4">
          <div className="relative">
            {(!imageUrl || !imgLoaded) && <Skeleton className="h-56 w-full rounded-xl" />}
            {imageUrl && (
              <button
                type="button"
                onClick={() => setFullscreen(true)}
                aria-label="Ver factura en pantalla completa"
                className={cn(
                  'group relative block w-full cursor-zoom-in overflow-hidden rounded-xl border border-slate-200',
                  !imgLoaded && 'invisible',
                )}
              >
                <img
                  src={imageUrl}
                  alt="Foto de la factura"
                  onLoad={() => setImgLoaded(true)}
                  className="max-h-56 w-full bg-cream object-contain"
                />
                <span className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 max-lg:opacity-100">
                  <Maximize2 size={14} />
                </span>
              </button>
            )}
          </div>

          <div className="rounded-xl border border-dashed border-slate-300 bg-cream/70 p-5 text-center">
            <p className="flex items-center justify-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide text-ink">
              <Store size={14} className="text-pine-600" />
              {receipt.parsed_data.comercio || expense.description}
            </p>
            {receipt.parsed_data.fecha && (
              <p className="mt-1 text-xs text-ink/40">{receipt.parsed_data.fecha}</p>
            )}
            <div className="mx-auto my-3 w-full border-t border-dashed border-slate-300" />
            {items.length === 0 ? (
              <p className="py-2 text-sm text-ink/40">Sin desglose de items</p>
            ) : (
              <div className="space-y-1.5 text-left text-sm">
                {items.map((it, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-ink/70">
                      {it.descripcion}
                      {Number(it.cantidad) > 1 && (
                        <span className="text-xs text-ink/40"> ×{it.cantidad}</span>
                      )}
                    </span>
                    <span className="shrink-0 font-medium text-ink/70">
                      {formatCurrency(Number(it.subtotal ?? it.valor_unitario))}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="mx-auto my-3 w-full border-t border-dashed border-slate-300" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink/50">
                TOTAL
              </span>
              <span className="font-display text-xl font-bold text-ink">
                {formatCurrency(itemsTotal || Number(expense.amount))}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-pine-50/60 px-4 py-3">
            <span className="text-sm text-ink/60">Gasto registrado</span>
            <span className="text-sm font-semibold text-ink">
              {expense.description} · {formatCurrency(Number(expense.amount))}
            </span>
          </div>
        </div>
      )}

      {fullscreen && imageUrl && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 p-4"
          onClick={() => setFullscreen(false)}
        >
          <button
            onClick={() => setFullscreen(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Cerrar pantalla completa"
          >
            <X size={20} />
          </button>
          <img
            src={imageUrl}
            alt="Foto de la factura en pantalla completa"
            className="max-h-[90dvh] max-w-full rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}
    </Modal>
  )
}
