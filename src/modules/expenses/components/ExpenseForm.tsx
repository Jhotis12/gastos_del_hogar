import { useEffect, useState } from 'react'
import { Mic } from 'lucide-react'
import Modal from '@/shared/components/ui/Modal'
import ConfirmDialog from '@/shared/components/ui/ConfirmDialog'
import MoneyInput from '@/shared/components/ui/MoneyInput'
import DateInput from '@/shared/components/ui/DateInput'
import SelectInput from '@/shared/components/ui/SelectInput'
import { useCategories } from '@/modules/categories/hooks/useCategories'
import { useMembers } from '@/modules/members/hooks/useMembers'
import { useAuth } from '@/shared/hooks/useAuth'
import VoiceExpenseModal from '@/modules/expenses/components/VoiceExpenseModal'
import {
  isVoiceExpenseEnabled,
  type VoiceDraft,
} from '@/modules/expenses/lib/voice'
import type { ExpenseWithRelations } from '@/shared/lib/types'
import { formatMoneyInput, parseMoneyInput } from '@/shared/lib/money'
import { todayISO } from '@/shared/lib/dates'
import { fieldClass } from '@/shared/components/ui/fieldClass'

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
  const { profile } = useAuth()

  const baseDate = initial?.expense_date ?? initialDate ?? todayISO()
  const defaultPaidBy = initial ? (initial.paid_by ?? '') : (profile?.id ?? '')

  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [paidBy, setPaidBy] = useState('')
  const [date, setDate] = useState(baseDate)
  const [error, setError] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voiceNotice, setVoiceNotice] = useState('')

  useEffect(() => {
    if (!open) return
    setAmount(initial ? String(initial.amount) : '')
    setDescription(initial?.description ?? '')
    setCategoryId(initial?.category_id ?? '')
    setPaidBy(defaultPaidBy)
    setDate(baseDate)
    setError('')
    setConfirmClose(false)
    setVoiceOpen(false)
    setVoiceNotice('')
  }, [open, initial, baseDate, defaultPaidBy])

  const dirty =
    open &&
    (amount !== (initial ? String(initial.amount) : '') ||
      description !== (initial?.description ?? '') ||
      categoryId !== (initial?.category_id ?? '') ||
      paidBy !== defaultPaidBy ||
      date !== baseDate)

  const requestClose = () => {
    if (dirty) {
      setConfirmClose(true)
      return
    }
    onClose()
  }

  const applyVoiceDraft = (draft: VoiceDraft) => {
    setAmount(formatMoneyInput(draft.amount))
    setDescription(draft.description)
    if (draft.date) setDate(draft.date)

    const categoryHint = draft.category_hint?.toLowerCase()
    if (categoryHint) {
      const category = categories?.find(
        (item) =>
          item.name.toLowerCase() === categoryHint ||
          item.name.toLowerCase().includes(categoryHint) ||
          categoryHint.includes(item.name.toLowerCase()),
      )
      if (category) setCategoryId(category.id)
    }

    const payerHint = draft.payer_hint?.toLowerCase()
    if (payerHint) {
      const member = members?.find((item) =>
        payerHint === 'yo'
          ? item.id === defaultPaidBy
          : item.full_name.toLowerCase().includes(payerHint),
      )
      if (member) setPaidBy(member.id)
    }

    setVoiceNotice('Borrador de voz listo: revisa los datos y confirma con el botón de guardar.')
    setError('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = parseMoneyInput(amount)
    if (value === null) {
      setError('Ingresa un monto válido (ej. 450.000)')
      return
    }
    if (!paidBy) {
      setError('Selecciona quién pagó el gasto')
      return
    }
    await onSave({
      amount: value,
      description: description.trim(),
      category_id: categoryId || null,
      paid_by: paidBy,
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
        {isVoiceExpenseEnabled() && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-pine-200 bg-pine-50/70 p-3">
            <div>
              <p className="text-sm font-medium text-pine-700">¿Prefieres dictarlo?</p>
              <p className="text-xs text-pine-600/70">
                Graba hasta 30 s; la IA propone un borrador y tú lo confirmas.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setVoiceOpen(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-pine-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-pine-800"
            >
              <Mic size={16} />
              Dictar gasto
            </button>
          </div>
        )}

        {voiceNotice && (
          <p role="status" className="rounded-lg bg-pine-50 px-3 py-2 text-sm text-pine-700">
            {voiceNotice}
          </p>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">Monto</label>
          <MoneyInput
            label="Monto"
            value={amount}
            onChange={setAmount}
            autoFocus
            placeholder="Ej. 450.000"
          />
        </div>

        <div>
          <label htmlFor="expense-description" className="mb-1 block text-sm font-medium text-ink/70">
            Descripción
          </label>
          <input
            id="expense-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={fieldClass}
            enterKeyHint="next" placeholder="Ej. Supermercado del mes"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">
              Categoría
            </label>
            <SelectInput
              aria-label="Categoría"
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
              aria-label="¿Quién pagó?"
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
            >
              <option value="" disabled>
                Selecciona quién pagó
              </option>
              {members?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </SelectInput>
          </div>
        </div>

        <div>
          <label htmlFor="expense-date" className="mb-1 block text-sm font-medium text-ink/70">Fecha</label>
          <DateInput
            id="expense-date"
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

      <VoiceExpenseModal
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onDraft={applyVoiceDraft}
      />
    </>
  )
}
