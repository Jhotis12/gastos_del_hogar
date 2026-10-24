import { useEffect, useState } from 'react'
import Modal from '@/shared/components/ui/Modal'
import MoneyInput from '@/shared/components/ui/MoneyInput'
import DateInput from '@/shared/components/ui/DateInput'
import SelectInput from '@/shared/components/ui/SelectInput'
import { useAddSavingsGoal, useUpdateSavingsGoal } from '@/modules/savings/hooks/useSavings'
import { useCreateSavingsMovement } from '@/modules/savings/hooks/useSavingsMovements'
import { useAuth } from '@/shared/hooks/useAuth'
import { useToast } from '@/shared/components/ui/Toast'
import type { SavingsGoal } from '@/shared/lib/types'
import { errorMessage } from '@/shared/lib/utils'
import { parseMoneyInput } from '@/shared/lib/money'
import { todayISO } from '@/shared/lib/dates'
import { fieldClass } from '@/shared/components/ui/fieldClass'

type GoalModalProps = {
  open: boolean
  initial?: SavingsGoal | null
  onClose: () => void
}

export default function GoalForm({ open, initial, onClose }: GoalModalProps) {
  const { profile } = useAuth()
  const add = useAddSavingsGoal()
  const update = useUpdateSavingsGoal()
  const createMovement = useCreateSavingsMovement()
  const toast = useToast()

  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [initialDeposit, setInitialDeposit] = useState('')
  const [owner, setOwner] = useState<'personal' | 'shared'>('personal')
  const [date, setDate] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setTarget(initial ? String(initial.target_amount) : '')
    setInitialDeposit('')
    setOwner(initial ? (initial.owner_id ? 'personal' : 'shared') : 'personal')
    setDate(initial?.target_date ?? '')
    setError('')
  }, [open, initial])

  const busy = add.isPending || update.isPending || createMovement.isPending

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetValue = parseMoneyInput(target)
    if (targetValue === null) {
      setError('Ingresa un monto objetivo válido (ej. 2.000.000)')
      return
    }
    if (!name.trim()) {
      setError('Dale un nombre a la meta (ej. Viaje, Emergencias)')
      return
    }

    try {
      if (initial) {
        await update.mutateAsync({
          id: initial.id,
          name: name.trim(),
          target_amount: targetValue,
          target_date: date || null,
        })
        toast.success('Meta actualizada')
        onClose()
        return
      }

      if (!profile?.id) throw new Error('Sin perfil')
      const goalId = await add.mutateAsync({
        name: name.trim(),
        target_amount: targetValue,
        target_date: date || null,
        owner_id: owner === 'personal' ? profile.id : null,
      })

      const deposit = parseMoneyInput(initialDeposit) ?? 0
      if (deposit > 0) {
        try {
          await createMovement.mutateAsync({
            goalId,
            amount: deposit,
            kind: 'deposit',
            movementDate: todayISO(),
          })
        } catch (err) {
          toast.error(`Meta creada, pero el depósito inicial falló: ${errorMessage(err)}`)
        }
      }

      toast.success('Meta creada')
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Modal
      open={open}
      title={initial ? 'Editar meta' : 'Nueva meta de ahorro'}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">Nombre</label>
          <input
            type="text"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
            enterKeyHint="next"
            placeholder="Ej. Viaje de fin de año"
          />
        </div>

        {!initial && (
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">
              ¿Quién puede verla?
            </label>
            <SelectInput
              aria-label="Tipo de meta"
              value={owner}
              onChange={(event) => setOwner(event.target.value as 'personal' | 'shared')}
            >
              <option value="personal">Personal (solo yo)</option>
              <option value="shared">Compartida (todo el hogar)</option>
            </SelectInput>
            <p className="mt-1 text-xs text-ink/45">
              Las metas personales no aparecen para los demás miembros.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">
              Monto objetivo
            </label>
            <MoneyInput
              label="Monto objetivo"
              value={target}
              onChange={setTarget}
              placeholder="Ej. 2.000.000"
            />
          </div>
          {!initial && (
            <div>
              <label className="mb-1 block text-sm font-medium text-ink/70">
                Depósito inicial (opcional)
              </label>
              <MoneyInput
                label="Depósito inicial"
                value={initialDeposit}
                onChange={setInitialDeposit}
                placeholder="0"
              />
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">
            Fecha objetivo (opcional)
          </label>
          <DateInput
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {initial && (
          <p className="rounded-lg bg-cream px-3 py-2 text-xs text-ink/55">
            {initial.owner_id ? 'Meta personal' : 'Meta compartida del hogar'} ·
            el saldo solo cambia con depósitos y retiros.
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-coral-100/60 px-3 py-2 text-sm text-coral-600">
            {error}
          </p>
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
            disabled={busy}
            className="rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800 disabled:opacity-50"
          >
            {busy
              ? 'Guardando…'
              : initial
                ? 'Guardar cambios'
                : 'Crear meta'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
