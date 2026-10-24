import { useEffect, useMemo, useState } from 'react'
import Modal from '@/shared/components/ui/Modal'
import SelectInput from '@/shared/components/ui/SelectInput'
import { useToast } from '@/shared/components/ui/Toast'
import { errorMessage } from '@/shared/lib/utils'
import { formatCurrency } from '@/shared/lib/money'
import { formatDate } from '@/shared/lib/dates'
import type { ExpenseWithRelations, Profile } from '@/shared/lib/types'

type Props = {
  open: boolean
  expenses: ExpenseWithRelations[]
  members: Profile[]
  busy?: boolean
  onClose: () => void
  onAssign: (ids: string[], memberId: string) => Promise<void>
}

export default function LegacyPayerModal({
  open,
  expenses,
  members,
  busy,
  onClose,
  onAssign,
}: Props) {
  const toast = useToast()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [payer, setPayer] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setSelected(new Set())
    setPayer(members[0]?.id ?? '')
    setError('')
  }, [open, members])

  const allSelected = expenses.length > 0 && selected.size === expenses.length
  const total = useMemo(
    () =>
      expenses
        .filter((expense) => selected.has(expense.id))
        .reduce((sum, expense) => sum + Number(expense.amount), 0),
    [expenses, selected],
  )

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const submit = async () => {
    if (!payer) {
      setError('Selecciona quién pagó estos gastos')
      return
    }
    if (selected.size === 0) {
      setError('Selecciona al menos un gasto')
      return
    }
    try {
      await onAssign([...selected], payer)
      toast.success(
        selected.size === 1
          ? 'Pagador asignado'
          : `${selected.size} gastos actualizados`,
      )
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Modal open={open} title="Gastos sin pagador" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-ink/60">
          Estos gastos históricos no suman a los totales personales. Elige un
          miembro para asignarlos; el total del hogar no cambia.
        </p>

        <button
          type="button"
          onClick={() =>
            setSelected(
              allSelected ? new Set() : new Set(expenses.map((expense) => expense.id)),
            )
          }
          className="min-h-11 text-sm font-medium text-pine-600 hover:text-ink"
        >
          {allSelected ? 'Quitar selección' : 'Seleccionar todos'}
        </button>

        <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-100">
          {expenses.map((expense) => (
            <li key={expense.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-cream/60">
                <input
                  type="checkbox"
                  checked={selected.has(expense.id)}
                  onChange={() => toggle(expense.id)}
                  className="h-5 w-5 accent-pine-700"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {expense.description || 'Sin descripción'}
                  </span>
                  <span className="block text-xs text-ink/45">
                    {formatDate(expense.expense_date)}
                  </span>
                </span>
                <span className="whitespace-nowrap text-sm font-semibold text-ink/70">
                  {formatCurrency(Number(expense.amount))}
                </span>
              </label>
            </li>
          ))}
        </ul>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">
            Asignar a
          </label>
          <SelectInput value={payer} onChange={(event) => setPayer(event.target.value)}>
            <option value="" disabled>
              Selecciona un miembro
            </option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name}
              </option>
            ))}
          </SelectInput>
        </div>

        {selected.size > 0 && (
          <p className="text-sm text-ink/60">
            {selected.size} seleccionado{selected.size !== 1 && 's'} ·{' '}
            {formatCurrency(total)}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-coral-600">
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
            type="button"
            onClick={submit}
            disabled={busy || selected.size === 0 || !payer}
            className="min-h-11 rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800 disabled:opacity-50"
          >
            {busy ? 'Asignando…' : 'Asignar pagador'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
