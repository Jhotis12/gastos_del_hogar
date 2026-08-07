import { useEffect, useState } from 'react'
import Modal from '@/shared/components/ui/Modal'
import MoneyInput from '@/shared/components/ui/MoneyInput'
import DateInput from '@/shared/components/ui/DateInput'
import SelectInput from '@/shared/components/ui/SelectInput'
import { useAddRecurring, useUpdateRecurring } from '@/modules/services/hooks/useRecurring'
import { useCategories } from '@/hooks/useCategories'
import { useMembers } from '@/modules/members/hooks/useMembers'
import { useToast } from '@/shared/components/ui/Toast'
import type { Frequency, RecurringExpenseWithRelations } from '@/shared/lib/types'
import { errorMessage } from '@/shared/lib/utils'
import { FREQUENCIES } from '@/shared/lib/constants'
import { parseMoneyInput } from '@/shared/lib/money'
import { todayISO } from '@/shared/lib/dates'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-surface px-4 py-3 text-base text-ink placeholder:text-ink/35 focus:border-pine-500 focus:outline-none focus:ring-2 focus:ring-pine-500/20'

export default function ServiceForm({
  open,
  initial,
  onClose,
}: {
  open: boolean
  initial?: RecurringExpenseWithRelations | null
  onClose: () => void
}) {
  const add = useAddRecurring()
  const update = useUpdateRecurring()
  const toast = useToast()
  const { data: categories } = useCategories()
  const { data: members } = useMembers()

  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [paidBy, setPaidBy] = useState('')
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [date, setDate] = useState(todayISO())
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setAmount(initial ? String(initial.amount) : '')
      setDescription(initial?.description ?? '')
      setCategoryId(initial?.category_id ?? '')
      setPaidBy(initial?.paid_by ?? '')
      setFrequency(initial?.frequency ?? 'monthly')
      setDate(initial?.next_due_date ?? todayISO())
      setError('')
    }
  }, [open, initial])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = parseMoneyInput(amount)
    if (value === null) {
      setError('Ingresa un monto válido (ej. 450.000)')
      return
    }
    if (!description.trim()) {
      setError('Describe el servicio (ej. Luz, Internet, Renta)')
      return
    }
    const payload = {
      amount: value,
      description: description.trim(),
      category_id: categoryId || null,
      paid_by: paidBy || null,
      frequency,
      next_due_date: date,
    }
    try {
      if (initial) {
        await update.mutateAsync({ id: initial.id, ...payload })
        toast.success('Servicio actualizado')
      } else {
        await add.mutateAsync(payload)
        toast.success('Servicio creado')
      }
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Modal
      open={open}
      title={initial ? 'Editar servicio' : 'Nuevo servicio'}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">
            Nombre del servicio
          </label>
          <input
            type="text"
            required
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            enterKeyHint="next" placeholder="Ej. Internet del hogar"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">Monto</label>
          <MoneyInput
            value={amount}
            onChange={setAmount}
            placeholder="Ej. 450.000"
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
              ¿Quién paga?
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">
              Frecuencia
            </label>
            <SelectInput
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as Frequency)}
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </SelectInput>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">
              Próximo vencimiento
            </label>
            <DateInput
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        {error && (
          <p role="alert" className="rounded-lg hover:bg-coral-100/70 px-3 py-2 text-sm text-coral-600">{error}</p>
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
            {add.isPending || update.isPending ? 'Guardando…' : initial ? 'Guardar cambios' : 'Agregar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
