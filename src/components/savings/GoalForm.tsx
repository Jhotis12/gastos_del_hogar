import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import MoneyInput from '@/components/ui/MoneyInput'
import DateInput from '@/components/ui/DateInput'
import { useAddSavingsGoal, useUpdateSavingsGoal } from '@/hooks/useSavings'
import { useToast } from '@/components/ui/Toast'
import type { SavingsGoal } from '@/lib/types'
import { errorMessage } from '@/lib/utils'
import { parseMoneyInput } from '@/lib/money'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-surface px-4 py-3 text-base text-ink placeholder:text-ink/35 focus:border-pine-500 focus:outline-none focus:ring-2 focus:ring-pine-500/20'

type GoalModalProps = {
  open: boolean
  initial?: SavingsGoal | null
  onClose: () => void
}

export default function GoalForm({ open, initial, onClose }: GoalModalProps) {

  const add = useAddSavingsGoal()
  const update = useUpdateSavingsGoal()
  const toast = useToast()

  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [saved, setSaved] = useState('')
  const [date, setDate] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setTarget(initial ? String(initial.target_amount) : '')
    setSaved(initial ? String(initial.saved_amount) : '')
    setDate(initial?.target_date ?? '')
    setError('')
  }, [open, initial])

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
    const savedValue = parseMoneyInput(saved) ?? 0
    try {
      if (initial) {
        await update.mutateAsync({
          id: initial.id,
          name: name.trim(),
          target_amount: targetValue,
          target_date: date || null,
        })
        toast.success('Meta actualizada')
      } else {
        await add.mutateAsync({
          name: name.trim(),
          target_amount: targetValue,
          target_date: date || null,
          saved_amount: savedValue,
        })
        toast.success('Meta creada')
      }
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
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
            className={inputClass}
            enterKeyHint="next" placeholder="Ej. Viaje de fin de año"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">
              Monto objetivo
            </label>
            <MoneyInput value={target} onChange={setTarget} placeholder="Ej. 2.000.000" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">
              Ahorrado inicial
            </label>
            <MoneyInput value={saved} onChange={setSaved} placeholder="0" />
          </div>
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
        {error && (
          <p className="rounded-lg bg-coral-100/60 px-3 py-2 text-sm text-coral-700">{error}</p>
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
            disabled={add.isPending || update.isPending}
            className="rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800 disabled:opacity-50"
          >
            {add.isPending || update.isPending
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
