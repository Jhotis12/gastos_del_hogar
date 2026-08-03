import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import DateInput from '@/components/ui/DateInput'
import MoneyInput from '@/components/ui/MoneyInput'
import SelectInput from '@/components/ui/SelectInput'
import { useToast } from '@/components/ui/Toast'
import {
  useAddIncome,
  useDeleteIncome,
  useIncomes,
  useUpdateIncome,
} from '@/hooks/useIncomes'
import { formatDate, todayISO } from '@/lib/dates'
import { formatCurrency, parseMoneyInput } from '@/lib/money'
import { errorMessage } from '@/lib/utils'
import type { IncomeWithRelations, Profile } from '@/lib/types'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-surface px-4 py-3 text-base text-ink placeholder:text-ink/35 focus:border-pine-500 focus:outline-none focus:ring-2 focus:ring-pine-500/20'

interface IncomeSectionProps {
  month: string
  members?: Profile[]
}

type Draft = {
  id?: string
  amount: string
  description: string
  memberId: string
  date: string
}

export default function IncomeSection({ month, members }: IncomeSectionProps) {
  const { data: incomes } = useIncomes(month)
  const addIncome = useAddIncome()
  const updateIncome = useUpdateIncome()
  const removeIncome = useDeleteIncome()
  const toast = useToast()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const total = incomes?.reduce((sum, i) => sum + Number(i.amount), 0) ?? 0

  const startAdd = () =>
    setDraft({ amount: '', description: '', memberId: '', date: todayISO() })

  const startEdit = (i: IncomeWithRelations) =>
    setDraft({
      id: i.id,
      amount: String(i.amount),
      description: i.description,
      memberId: i.member_id ?? '',
      date: i.income_date,
    })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft) return
    const value = parseMoneyInput(draft.amount)
    if (value === null) {
      toast.error('Ingresa un monto válido (ej. 450.000)')
      return
    }
    const payload = {
      amount: value,
      description: draft.description.trim(),
      member_id: draft.memberId || null,
      income_date: draft.date,
    }
    try {
      if (draft.id) {
        await updateIncome.mutateAsync({ id: draft.id, ...payload })
        toast.success('Dinero extra actualizado')
      } else {
        await addIncome.mutateAsync(payload)
        toast.success('Dinero extra registrado')
      }
      setDraft(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const confirmDelete = async () => {
    if (!confirmId) return
    try {
      await removeIncome.mutateAsync(confirmId)
      toast.success('Dinero extra eliminado')
      setConfirmId(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const memberName = (id: string | null) =>
    members?.find((m) => m.id === id)?.full_name ?? ''

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">Otros ingresos del mes</h2>
          <p className="mt-0.5 text-xs text-ink/40">
            Dinero que no es nómina: ventas, regalos, reembolsos…
          </p>
        </div>
        {total > 0 && (
          <span className="text-sm font-semibold text-pine-600">
            +{formatCurrency(total)}
          </span>
        )}
      </div>

      {!incomes || incomes.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink/40">
          Aún no hay otros ingresos este mes
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {incomes.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {i.description || 'Sin descripción'}
                </p>
                <p className="mt-0.5 text-xs text-ink/40">
                  {memberName(i.member_id) && `${memberName(i.member_id)} · `}
                  {formatDate(i.income_date)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="text-sm font-semibold text-pine-600">
                  +{formatCurrency(Number(i.amount))}
                </span>
                <button
                  onClick={() => startEdit(i)}
                  className="rounded-lg p-2 text-ink/40 hover:bg-slate-100 hover:text-ink/55"
                  aria-label="Editar dinero extra"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => setConfirmId(i.id)}
                  className="rounded-lg p-2 text-ink/40 hover:bg-coral-100/70 hover:text-coral-600"
                  aria-label="Eliminar dinero extra"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!draft && (
        <div className="border-t border-slate-100 px-5 py-4">
          <button
            onClick={startAdd}
            className="inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm text-ink/40 hover:border-pine-400 hover:text-pine-600"
          >
            <Plus size={16} />
            Registrar dinero extra
          </button>
        </div>
      )}

      {draft && (
        <form onSubmit={submit} className="space-y-4 border-t border-slate-100 p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">Monto</label>
            <MoneyInput
              value={draft.amount}
              onChange={(amount) => setDraft({ ...draft, amount })}
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
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              className={inputClass}
              placeholder="Ej. Vendí la bici, regalo, reembolso…"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink/70">
                ¿Quién recibió? (opcional)
              </label>
              <SelectInput
                value={draft.memberId}
                onChange={(e) => setDraft({ ...draft, memberId: e.target.value })}
              >
                <option value="">Sin asignar</option>
                {members?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink/70">Fecha</label>
              <DateInput
                type="date"
                required
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-cream"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={addIncome.isPending || updateIncome.isPending}
              className="rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800 disabled:opacity-50"
            >
              {draft.id ? 'Guardar cambios' : 'Guardar'}
            </button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={!!confirmId}
        title="Eliminar dinero extra"
        message="¿Eliminar este ingreso? El saldo general se recalculará."
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmId(null)}
        busy={removeIncome.isPending}
      />
    </div>
  )
}
