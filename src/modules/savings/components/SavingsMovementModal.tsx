import { useEffect, useState } from 'react'
import Modal from '@/shared/components/ui/Modal'
import MoneyInput from '@/shared/components/ui/MoneyInput'
import DateInput from '@/shared/components/ui/DateInput'
import { useCreateSavingsMovement } from '@/modules/savings/hooks/useSavingsMovements'
import { useToast } from '@/shared/components/ui/Toast'
import type { SavingsGoal } from '@/shared/lib/types'
import { formatCurrency, parseMoneyInput } from '@/shared/lib/money'
import { errorMessage } from '@/shared/lib/utils'
import { todayISO } from '@/shared/lib/dates'

type Props = {
  open: boolean
  goal: SavingsGoal | null
  mode: 'deposit' | 'withdrawal'
  maxWithdrawal?: number | null
  onClose: () => void
}

export default function SavingsMovementModal({
  open,
  goal,
  mode,
  maxWithdrawal,
  onClose,
}: Props) {
  const create = useCreateSavingsMovement()
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setAmount('')
    setDate(todayISO())
    setError('')
  }, [open, goal, mode])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!goal) return
    if (!navigator.onLine) {
      setError('El ahorro requiere conexión. Inténtalo de nuevo cuando estés en línea.')
      return
    }
    const value = parseMoneyInput(amount)
    if (value === null || value <= 0) {
      setError('Ingresa un monto válido')
      return
    }
    if (mode === 'withdrawal') {
      if (value > Number(goal.saved_amount)) {
        setError('No puedes retirar más de lo ahorrado en la meta')
        return
      }
      if (maxWithdrawal !== null && maxWithdrawal !== undefined && value > maxWithdrawal) {
        setError(
          `En una meta compartida solo puedes retirar tu aporte: ${formatCurrency(maxWithdrawal)}`,
        )
        return
      }
    }

    try {
      await create.mutateAsync({
        goalId: goal.id,
        amount: value,
        kind: mode,
        movementDate: date,
      })
      toast.success(mode === 'deposit' ? 'Depósito registrado' : 'Retiro registrado')
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Modal
      open={open}
      title={mode === 'deposit' ? 'Depositar a la meta' : 'Retirar de la meta'}
      onClose={onClose}
    >
      {goal && (
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-xl bg-cream/70 px-3 py-2.5 text-sm text-ink/60">
            <p className="font-medium text-ink">{goal.name}</p>
            <p className="mt-0.5">
              Ahorrado: {formatCurrency(Number(goal.saved_amount))}
              {mode === 'withdrawal' && maxWithdrawal !== null && maxWithdrawal !== undefined && (
                <> · Tu aporte disponible: {formatCurrency(maxWithdrawal)}</>
              )}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">
              {mode === 'deposit' ? 'Monto a depositar' : 'Monto a retirar'}
            </label>
            <MoneyInput
              label={mode === 'deposit' ? 'Monto a depositar' : 'Monto a retirar'}
              value={amount}
              onChange={setAmount}
              autoFocus
              placeholder="Ej. 200.000"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">Fecha</label>
            <DateInput
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-coral-100/60 px-3 py-2 text-sm text-coral-600">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-cream"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="min-h-11 rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800 disabled:opacity-50"
            >
              {create.isPending
                ? 'Procesando…'
                : mode === 'deposit'
                  ? 'Confirmar depósito'
                  : 'Confirmar retiro'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
