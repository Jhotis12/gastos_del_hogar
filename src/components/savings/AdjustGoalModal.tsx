import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import MoneyInput from '@/components/ui/MoneyInput'
import { useAdjustSavingsGoal } from '@/hooks/useSavings'
import { useToast } from '@/components/ui/Toast'
import type { SavingsGoal } from '@/lib/types'
import { formatCurrency, parseMoneyInput } from '@/lib/money'
import { errorMessage } from '@/lib/utils'

type AdjustModalProps = {
  open: boolean
  goal: SavingsGoal | null
  mode: 'deposit' | 'withdraw'
  onClose: () => void
}

export default function AdjustModal({ open, goal, mode, onClose }: AdjustModalProps) {

  const adjust = useAdjustSavingsGoal()
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setAmount('')
      setError('')
    }
  }, [open, goal])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!goal) return
    const value = parseMoneyInput(amount)
    if (value === null || value <= 0) {
      setError('Ingresa un monto válido')
      return
    }
    const next = mode === 'deposit' ? goal.saved_amount + value : goal.saved_amount - value
    if (next < 0) {
      setError('No puedes retirar más de lo ahorrado')
      return
    }
    try {
      await adjust.mutateAsync({ id: goal.id, saved_amount: next })
      toast.success(mode === 'deposit' ? 'Depósito registrado' : 'Retiro registrado')
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
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
          <p className="text-sm text-ink/60">
            <span className="font-medium text-ink">{goal.name}</span> · ahorrado{' '}
            {formatCurrency(Number(goal.saved_amount))}
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">
              {mode === 'deposit' ? 'Monto a depositar' : 'Monto a retirar'}
            </label>
            <MoneyInput
              value={amount}
              onChange={setAmount}
              autoFocus
              placeholder="Ej. 500.000"
            />
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-coral-100/60 px-3 py-2 text-sm text-coral-600">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-cream"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={adjust.isPending}
              className="rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800 disabled:opacity-50"
            >
              {adjust.isPending ? 'Procesando…' : mode === 'deposit' ? 'Confirmar depósito' : 'Confirmar retiro'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
