import { useEffect, useMemo, useState } from 'react'
import Modal from '@/shared/components/ui/Modal'
import MoneyInput from '@/shared/components/ui/MoneyInput'
import SelectInput from '@/shared/components/ui/SelectInput'
import { useAuth } from '@/shared/hooks/useAuth'
import { useToast } from '@/shared/components/ui/Toast'
import {
  useSaveSavingsPlan,
  useSavingsPlans,
} from '@/modules/savings/hooks/useSavingsMovements'
import type { SavingsGoal } from '@/shared/lib/types'
import { parseMoneyInput } from '@/shared/lib/money'
import { errorMessage } from '@/shared/lib/utils'

const DAYS = Array.from({ length: 31 }, (_, index) => index + 1)

type Props = {
  open: boolean
  goal: SavingsGoal | null
  onClose: () => void
}

export default function SavingsPlanModal({ open, goal, onClose }: Props) {
  const { profile } = useAuth()
  const { data: plans } = useSavingsPlans()
  const save = useSaveSavingsPlan()
  const toast = useToast()

  const plan = useMemo(
    () =>
      (plans ?? []).find(
        (row) => row.goal_id === goal?.id && row.member_id === profile?.id,
      ),
    [plans, goal?.id, profile?.id],
  )

  const [amount, setAmount] = useState('')
  const [day, setDay] = useState(1)
  const [active, setActive] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setAmount(plan ? String(plan.amount) : '')
    setDay(plan?.day_of_month ?? 1)
    setActive(plan?.is_active ?? true)
    setError('')
  }, [open, plan])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!goal) return
    const value = parseMoneyInput(amount)
    if (value === null || value <= 0) {
      setError('Ingresa un monto válido')
      return
    }
    try {
      await save.mutateAsync({
        id: plan?.id,
        goal_id: goal.id,
        amount: value,
        day_of_month: day,
        is_active: active,
      })
      toast.success(plan ? 'Autoahorro actualizado' : 'Autoahorro configurado')
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Modal open={open} title={`Autoahorro · ${goal?.name ?? ''}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink/55">
          Se ejecuta al abrir la app o reconectar. Recupera hasta 12 meses
          pendientes, omite meses sin saldo y se pausa al alcanzar la meta.
        </p>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">
            Monto mensual
          </label>
          <MoneyInput
            label="Monto mensual"
            value={amount}
            onChange={setAmount}
            placeholder="Ej. 100.000"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">
              Día del mes
            </label>
            <SelectInput
              value={day}
              onChange={(event) => setDay(Number(event.target.value))}
            >
              {DAYS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </SelectInput>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">
              Estado
            </label>
            <SelectInput
              value={active ? 'active' : 'paused'}
              onChange={(event) => setActive(event.target.value === 'active')}
            >
              <option value="active">Activo</option>
              <option value="paused">Pausado</option>
            </SelectInput>
          </div>
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
            disabled={save.isPending}
            className="min-h-11 rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800 disabled:opacity-50"
          >
            {save.isPending ? 'Guardando…' : 'Guardar autoahorro'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
