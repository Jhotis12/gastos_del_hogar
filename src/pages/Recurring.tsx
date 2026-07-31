import { useMemo, useState } from 'react'
import { Plus, Trash2, Repeat, Pencil, CheckCircle2, Clock } from 'lucide-react'
import { useApplyRecurring, useDeleteRecurring, useRecurringExpenses, useToggleRecurring } from '@/hooks/useRecurring'
import { useExpenses } from '@/hooks/useExpenses'
import { useSalaries } from '@/hooks/useMembers'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import CategoryBadge from '@/components/ui/CategoryBadge'
import Loading from '@/components/ui/Loading'
import QueryError from '@/components/ui/QueryError'
import MonthPicker from '@/components/ui/MonthPicker'
import ServiceForm from '@/components/services/ServiceForm'
import { useToast } from '@/components/ui/Toast'
import type { RecurringExpenseWithRelations } from '@/lib/types'
import { errorMessage } from '@/lib/utils'
import { FREQUENCY_LABELS } from '@/lib/constants'
import { currentMonthKey, shiftMonth } from '@/lib/dates'
import { formatCurrency } from '@/lib/money'

export default function Recurring() {
  const [month, setMonth] = useState(currentMonthKey())
  const { data: recurring, isLoading, error } = useRecurringExpenses()
  const { data: expenses } = useExpenses(month)
  const { data: salaries } = useSalaries(month)
  const applyRecurring = useApplyRecurring(month)
  const toggle = useToggleRecurring()
  const remove = useDeleteRecurring()
  const toast = useToast()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringExpenseWithRelations | null>(null)
  const [deleting, setDeleting] = useState<RecurringExpenseWithRelations | null>(null)

  const monthStart = `${month.slice(0, 7)}-01`
  const nextMonthStart = `${shiftMonth(month, 1).slice(0, 7)}-01`

  const { totalFixed, pendingCount } = useMemo(() => {
    const active = recurring?.filter((r) => r.is_active) ?? []
    const inMonth = active.filter((r) => r.next_due_date >= monthStart && r.next_due_date < nextMonthStart)
    const total = inMonth.reduce((sum, r) => sum + Number(r.amount), 0)
    const pend = active.filter((r) => r.next_due_date < nextMonthStart).length
    return { totalFixed: total, pendingCount: pend }
  }, [recurring, monthStart, nextMonthStart])

  const totalIncome =
    salaries?.reduce((sum, s) => sum + Number(s.amount), 0) ?? 0
  const fixedRatio = totalIncome > 0 ? totalFixed / totalIncome : 0

  const paidIds = useMemo(() => {
    const ids = new Set<string>()
    for (const e of expenses ?? []) {
      if (e.recurring_id) ids.add(e.recurring_id)
    }
    return ids
  }, [expenses])

  const handleToggle = async (r: RecurringExpenseWithRelations) => {
    try {
      await toggle.mutateAsync({ id: r.id, is_active: !r.is_active })
      toast.success(r.is_active ? 'Servicio desactivado' : 'Servicio activado')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await remove.mutateAsync(deleting.id)
      toast.success('Servicio eliminado')
      setDeleting(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const handleApply = async () => {
    try {
      const count = await applyRecurring.mutateAsync()
      toast.success(
        count > 0
          ? `${count} servicio${count !== 1 ? 's' : ''} aplicado${count !== 1 ? 's' : ''} a los gastos del mes`
          : 'No había servicios pendientes para este mes',
      )
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-ink">
            <Repeat size={24} className="text-pine-600" />
            Servicios y gastos fijos
          </h1>
          <p className="text-sm text-ink/50">
            Cobros automáticos mensuales: marca cuáles ya se pagaron
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthPicker month={month} onChange={setMonth} />
          <button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800"
          >
            <Plus size={16} />
            Nuevo servicio
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm font-medium text-ink/50">Gastos fijos del mes</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">
            {formatCurrency(totalFixed)}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-ink/50">vs ingreso unificado</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">
            {totalIncome > 0 ? `${Math.round(fixedRatio * 100)}%` : '—'}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${fixedRatio > 0.5 ? 'hover:bg-coral-100/700' : fixedRatio > 0.3 ? 'bg-gold-100/600' : 'bg-pine-500'}`}
              style={{ width: `${Math.min(100, fixedRatio * 100)}%` }}
            />
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-2xl border border-pine-200 bg-pine-50 p-5">
          <div>
            <p className="text-sm font-medium text-pine-800">Pendientes este mes</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-indigo-900">
              {pendingCount}
            </p>
          </div>
          {pendingCount > 0 && (
            <button
              onClick={handleApply}
              disabled={applyRecurring.isPending}
              className="mt-3 rounded-lg bg-pine-700 px-3 py-2 text-sm font-medium text-white hover:bg-pine-800 disabled:opacity-50"
            >
              {applyRecurring.isPending ? 'Aplicando…' : 'Aplicar al mes'}
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <Loading />
      ) : error ? (
        <QueryError error={error} />
      ) : !recurring || recurring.length === 0 ? (
        <div className="card border-2 border-dashed border-ink/10 py-16 text-center">
          <p className="text-sm text-ink/40">
            No hay servicios registrados. Agrega el primero.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden card">
          <ul className="divide-y divide-slate-100">
            {recurring.map((r) => {
              const paid = paidIds.has(r.id)
              const dueThisMonth = r.next_due_date >= monthStart && r.next_due_date < nextMonthStart
              return (
                <li
                  key={r.id}
                  className={`flex items-center justify-between gap-4 px-5 py-4 ${
                    !r.is_active ? 'opacity-50' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-ink">
                        {r.description || 'Sin nombre'}
                      </p>
                      {r.is_active &&
                        (paid ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-pine-50 px-2 py-0.5 text-xs font-medium text-pine-600">
                            <CheckCircle2 size={12} />
                            Pagado
                          </span>
                        ) : dueThisMonth ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gold-100/60 px-2 py-0.5 text-xs font-medium text-gold-600">
                            <Clock size={12} />
                            Pendiente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-ink/50">
                            <Clock size={12} />
                            No vence este mes
                          </span>
                        ))}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink/50">
                      {r.category && (
                        <CategoryBadge name={r.category.name} color={r.category.color} />
                      )}
                      <span>{r.payer?.full_name || 'Sin asignar'}</span>
                      <span>· {FREQUENCY_LABELS[r.frequency] ?? r.frequency}</span>
                      <span>· vence {r.next_due_date}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <p className="text-sm font-semibold text-ink">
                      {formatCurrency(Number(r.amount))}
                    </p>
                    <button
                      onClick={() => {
                        setEditing(r)
                        setFormOpen(true)
                      }}
                      className="rounded-lg p-1.5 text-ink/40 hover:bg-slate-100 hover:text-ink/55"
                      aria-label="Editar servicio"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleToggle(r)}
                      disabled={toggle.isPending}
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        r.is_active ? 'bg-pine-700' : 'bg-slate-300'
                      }`}
                      aria-label={r.is_active ? 'Desactivar' : 'Activar'}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                          r.is_active ? 'left-[22px]' : 'left-0.5'
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => setDeleting(r)}
                      className="rounded-lg p-1.5 text-ink/40 hover:bg-coral-100/70 hover:text-coral-600"
                      aria-label="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <ServiceForm
        open={formOpen}
        initial={editing}
        onClose={() => setFormOpen(false)}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar servicio"
        message={`¿Eliminar "${deleting?.description || 'Sin nombre'}"? Los gastos ya registrados no se afectan.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
        busy={remove.isPending}
      />
    </div>
  )
}
