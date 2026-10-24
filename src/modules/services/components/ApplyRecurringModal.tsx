import { useEffect, useState } from 'react'
import { CheckCircle2, Clock } from 'lucide-react'
import { useApplyRecurringOne } from '@/modules/services/hooks/useRecurring'
import Modal from '@/shared/components/ui/Modal'
import CategoryBadge from '@/shared/components/ui/CategoryBadge'
import { useToast } from '@/shared/components/ui/Toast'
import type { RecurringExpenseWithRelations } from '@/shared/lib/types'
import { errorMessage } from '@/shared/lib/utils'
import { FREQUENCY_LABELS } from '@/shared/lib/constants'
import { formatDate } from '@/shared/lib/dates'
import { formatCurrency } from '@/shared/lib/money'

interface ApplyRecurringModalProps {
  open: boolean
  month: string
  pending: RecurringExpenseWithRelations[]
  onClose: () => void
}

export default function ApplyRecurringModal({ open, month, pending, onClose }: ApplyRecurringModalProps) {
  const toast = useToast()
  const applyOne = useApplyRecurringOne(month)
  const [index, setIndex] = useState(0)
  const [applied, setApplied] = useState(0)

  useEffect(() => {
    if (!open) return
    setIndex(0)
    setApplied(0)
  }, [open])

  useEffect(() => {
    if (open && pending.length > 0 && index >= pending.length) {
      toast.success(
        applied > 0
          ? `${applied} de ${pending.length} servicio${pending.length !== 1 ? 's' : ''} marcado${applied !== 1 ? 's' : ''} como pagado${applied !== 1 ? 's' : ''}`
          : 'Ningún servicio marcado como pagado',
      )
      onClose()
    }
  }, [open, index, pending.length, applied, onClose, toast])

  const current = pending[index]
  if (!open || !current) return null

  const advance = () => setIndex((i) => i + 1)

  const handlePaid = async () => {
    try {
      const result = await applyOne.mutateAsync(current.id)
      if (result === 1) setApplied((n) => n + 1)
    } catch (err) {
      toast.error(errorMessage(err))
    }
    advance()
  }

  return (
    <Modal open={open} title="Aplicar al mes" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-ink/40">
            <span>
              Servicio {index + 1} de {pending.length}
            </span>
            <span className="tabular-nums">
              {applied} pagado{applied !== 1 && 's'}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-pine-500 transition-all"
              style={{ width: `${((index + 1) / pending.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-cream/60 p-5 text-center">
          <p className="truncate text-sm font-medium text-ink/60">{current.description || 'Sin nombre'}</p>
          <p className="mt-1 font-display text-3xl font-bold tabular-nums tracking-tight text-ink">
            {formatCurrency(Number(current.amount))}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-ink/50">
            {current.category && (
              <CategoryBadge name={current.category.name} color={current.category.color} />
            )}
            <span>{current.payer?.full_name || 'Sin asignar'}</span>
            <span>· {FREQUENCY_LABELS[current.frequency] ?? current.frequency}</span>
            <span>· vence {formatDate(current.next_due_date)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={handlePaid}
            disabled={applyOne.isPending}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-pine-700 text-sm font-semibold text-white hover:bg-pine-800 disabled:opacity-50"
          >
            {applyOne.isPending ? (
              'Aplicando…'
            ) : (
              <>
                <CheckCircle2 size={18} />
                Sí, lo pagué
              </>
            )}
          </button>
          <button
            onClick={advance}
            disabled={applyOne.isPending}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium text-ink/60 hover:bg-cream hover:text-ink disabled:opacity-50"
          >
            <Clock size={18} />
            Saltar (queda pendiente)
          </button>
        </div>
      </div>
    </Modal>
  )
}
