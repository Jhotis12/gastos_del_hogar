import { useEffect, useState } from 'react'
import Modal from '@/shared/components/ui/Modal'
import ConfirmDialog from '@/shared/components/ui/ConfirmDialog'
import MoneyInput from '@/shared/components/ui/MoneyInput'
import DateInput from '@/shared/components/ui/DateInput'
import SelectInput from '@/shared/components/ui/SelectInput'
import { useCategories } from '@/hooks/useCategories'
import { useMembers } from '@/modules/members/hooks/useMembers'
import type { ExpenseWithRelations } from '@/shared/lib/types'
import { parseMoneyInput } from '@/shared/lib/money'
import { todayISO } from '@/shared/lib/dates'

interface ExpenseFormProps {
  open: boolean
  initial?: ExpenseWithRelations | null
  initialDate?: string
  onClose: () => void
  onSave: (input: {
    amount: number
    description: string
    category_id: string | null
    paid_by: string | null
    expense_date: string
  }) => Promise<void>
  busy?: boolean
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-surface px-4 py-3 text-base text-ink placeholder:text-ink/35 focus:border-pine-500 focus:outline-none focus:ring-2 focus:ring-pine-500/20'

export default function ExpenseForm({
  open,
  initial,
  initialDate,
  onClose,
  onSave,
  busy,
}: ExpenseFormProps) {
  const { data: categories } = useCategories()
  const { data: members } = useMembers()

  const baseDate = initial?.expense_date ?? initialDate ?? todayISO()

  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [paidBy, setPaidBy] = useState('')
  const [date, setDate] = useState(baseDate)
  const [error, setError] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)

  useEffect(() => {
    if (!open) return
    setAmount(initial ? String(initial.amount) : '')
    setDescription(initial?.description ?? '')
    setCategoryId(initial?.category_id ?? '')
    setPaidBy(initial?.paid_by ?? '')
    setDate(baseDate)
    setError('')
    setConfirmClose(false)
  }, [open, initial, baseDate])

  const dirty =
    open &&
    (amount !== (initial ? String(initial.amount) : '') ||
      description !== (initial?.description ?? '') ||
      categoryId !== (initial?.category_id ?? '') ||
      paidBy !== (initial?.paid_by ?? '') ||
      date !== baseDate)

  const requestClose = () => {
    if (dirty) {
      setConfirmClose(true)
      return
    }
    onClose()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = parseMoneyInput(amount)
    if (value === null) {
      setError('Ingresa un monto válido (ej. 450.000)')
      return
    }
    await onSave({
      amount: value,
      description: description.trim(),
      category_id: categoryId || null,
      paid_by: paidBy || null,
      expense_date: date,
    })
    onClose()
  }

  return (
    <>
      <Modal
        open={open}
        title={initial ? 'Editar gasto' : 'Nuevo gasto'}
        onClose={requestClose}
      >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">Monto</label>
          <MoneyInput
            value={amount}
            onChange={setAmount}
            autoFocus
            placeholder="Ej. 450.000"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">
            Descripción
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            enterKeyHint="next" placeholder="Ej. Supermercado del mes"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">
              Categoría
            </label>
            <SelectInput
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Sin categoría</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectInput>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">
              ¿Quién pagó?
            </label>
            <SelectInput
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {members?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </SelectInput>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">Fecha</label>
          <DateInput
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg hover:bg-coral-100/70 px-3 py-2 text-sm text-coral-600">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={requestClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-cream"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800 disabled:opacity-50"
          >
            {busy ? 'Guardando…' : initial ? 'Guardar cambios' : 'Agregar gasto'}
          </button>
        </div>
      </form>
      </Modal>

      <ConfirmDialog
        open={confirmClose}
        title="Descartar cambios"
        message="Tienes cambios sin guardar en este formulario. ¿Seguro que quieres descartarlos?"
        confirmLabel="Descartar"
        onConfirm={() => {
          setConfirmClose(false)
          onClose()
        }}
        onCancel={() => setConfirmClose(false)}
      />
    </>
  )
}
