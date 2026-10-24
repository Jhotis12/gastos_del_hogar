import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import Modal from '@/shared/components/ui/Modal'
import ConfirmDialog from '@/shared/components/ui/ConfirmDialog'
import Skeleton from '@/shared/components/ui/Skeleton'
import { useToast } from '@/shared/components/ui/Toast'
import {
  useDeleteSavingsMovement,
  useSavingsMovements,
} from '@/modules/savings/hooks/useSavingsMovements'
import type { SavingsGoal, SavingsMovement } from '@/shared/lib/types'
import { formatCurrency } from '@/shared/lib/money'
import { formatDate } from '@/shared/lib/dates'
import { errorMessage } from '@/shared/lib/utils'

const KIND_LABEL: Record<SavingsMovement['kind'], string> = {
  opening: 'Saldo migrado',
  deposit: 'Depósito',
  withdrawal: 'Retiro',
  auto: 'Autoahorro',
}

type Props = {
  open: boolean
  goal: SavingsGoal | null
  onClose: () => void
}

export default function SavingsHistoryModal({ open, goal, onClose }: Props) {
  const { data: movements, isPending } = useSavingsMovements(goal?.id)
  const remove = useDeleteSavingsMovement()
  const toast = useToast()
  const [deleting, setDeleting] = useState<SavingsMovement | null>(null)

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await remove.mutateAsync(deleting.id)
      toast.success('Movimiento deshecho')
      setDeleting(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <>
      <Modal open={open} title={`Movimientos · ${goal?.name ?? ''}`} onClose={onClose}>
        {isPending ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : !movements || movements.length === 0 ? (
          <p className="text-sm text-ink/55">Esta meta todavía no tiene movimientos.</p>
        ) : (
          <ul className="-mx-2 divide-y divide-slate-100">
            {movements.map((movement) => {
              const manual =
                movement.kind === 'deposit' || movement.kind === 'withdrawal'
              return (
                <li
                  key={movement.id}
                  className="flex items-center justify-between gap-3 px-2 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {KIND_LABEL[movement.kind]}
                      <span className="ml-2 text-xs font-normal text-ink/45">
                        {formatDate(movement.movement_date)}
                      </span>
                    </p>
                    <p className="truncate text-xs text-ink/50">
                      {movement.member?.full_name ?? 'Hogar / legado'}
                      {movement.note ? ` · ${movement.note}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span
                      className={
                        movement.amount < 0
                          ? 'whitespace-nowrap text-sm font-semibold text-coral-600'
                          : 'whitespace-nowrap text-sm font-semibold text-pine-600'
                      }
                    >
                      {movement.amount < 0 ? '−' : '+'}
                      {formatCurrency(Math.abs(Number(movement.amount)))}
                    </span>
                    {manual && (
                      <button
                        onClick={() => setDeleting(movement)}
                        className="rounded-lg p-2.5 text-ink/35 hover:bg-coral-100/70 hover:text-coral-600"
                        aria-label="Deshacer movimiento"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Deshacer movimiento"
        message={`¿Deshacer este ${deleting ? KIND_LABEL[deleting.kind].toLowerCase() : 'movimiento'} de ${deleting ? formatCurrency(Math.abs(Number(deleting.amount))) : ''}? El saldo de la meta y el disponible se recalculan.`}
        confirmLabel="Deshacer"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        busy={remove.isPending}
      />
    </>
  )
}
