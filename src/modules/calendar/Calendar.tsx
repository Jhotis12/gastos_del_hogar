import { useMemo, useState } from 'react'
import { Plus, Zap, CalendarDays } from 'lucide-react'
import { useAddExpense, useExpenses } from '@/modules/expenses/hooks/useExpenses'
import { useRecurringExpenses } from '@/modules/services/hooks/useRecurring'
import MonthPicker from '@/shared/components/ui/MonthPicker'
import PageSkeleton from '@/shared/components/ui/PageSkeleton'
import QueryError from '@/shared/components/ui/QueryError'
import Modal from '@/shared/components/ui/Modal'
import ExpenseForm from '@/modules/expenses/components/ExpenseForm'
import CategoryBadge from '@/shared/components/ui/CategoryBadge'
import { useToast } from '@/shared/components/ui/Toast'
import type { ExpenseWithRelations } from '@/shared/lib/types'
import { cn, errorMessage } from '@/shared/lib/utils'
import { WEEKDAYS } from '@/shared/lib/constants'
import { daysInMonth, formatDate, monthLabel, todayISO } from '@/shared/lib/dates'
import { formatCurrency } from '@/shared/lib/money'

import { usePageTitle } from '@/shared/hooks/usePageTitle'
import { useMonthParam } from '@/shared/hooks/useMonthParam'

export default function Calendar() {
  usePageTitle('Calendario')
  const [month, setMonth] = useMonthParam()
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [formDate, setFormDate] = useState<string | null>(null)
  const toast = useToast()

  const { data: expenses, isLoading, error, refetch } = useExpenses(month)
  const { data: recurring } = useRecurringExpenses()
  const addExpense = useAddExpense()

  const [year, m] = month.split('-').map(Number)
  const month0 = (m ?? 1) - 1

  const cells = useMemo(() => {
    const total = daysInMonth(year, month0)
    const offset = (new Date(year, month0, 1).getDay() + 6) % 7
    const list: (number | null)[] = [...Array(offset).fill(null)]
    for (let d = 1; d <= total; d++) list.push(d)
    while (list.length % 7 !== 0) list.push(null)
    return list
  }, [year, month0])

  const byDay = useMemo(() => {
    const map = new Map<string, ExpenseWithRelations[]>()
    for (const e of expenses ?? []) {
      const list = map.get(e.expense_date) ?? []
      list.push(e)
      map.set(e.expense_date, list)
    }
    return map
  }, [expenses])

  const servicesDueByDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of recurring ?? []) {
      if (!r.is_active) continue
      map.set(r.next_due_date, (map.get(r.next_due_date) ?? 0) + 1)
    }
    return map
  }, [recurring])

  const dayTotal = (iso: string) =>
    (byDay.get(iso) ?? []).reduce((sum, e) => sum + Number(e.amount), 0)

  const monthTotal = (expenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0)
  const monthPrefix = month.slice(0, 7)
  const servicesDueCount = [...servicesDueByDay.entries()]
    .filter(([iso]) => iso.startsWith(monthPrefix))
    .reduce((sum, [, n]) => sum + n, 0)

  const selected = selectedDay ? (byDay.get(selectedDay) ?? []) : []
  const selectedTotal = selected.reduce((sum, e) => sum + Number(e.amount), 0)
  const selectedServices = selectedDay
    ? (recurring ?? []).filter((r) => r.is_active && r.next_due_date === selectedDay)
    : []

  const handleSave = async (input: {
    amount: number
    description: string
    category_id: string | null
    paid_by: string | null
    expense_date: string
  }) => {
    try {
      await addExpense.mutateAsync(input)
      toast.success('Gasto registrado')
    } catch (err) {
      toast.error(errorMessage(err))
      throw err
    }
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-up flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-ink">
            <CalendarDays size={24} className="text-pine-600" />
            Calendario
          </h1>
          <p className="text-sm text-ink/50">
            Seguimiento diario de gastos y vencimientos del mes
          </p>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      <div className="animate-fade-up grid grid-cols-1 gap-4 sm:grid-cols-3" style={{ animationDelay: '90ms' }}>
        <div className="card p-5">
          <p className="text-sm font-medium text-ink/50">Gastos del mes</p>
          <p className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">
            {formatCurrency(monthTotal)}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-ink/50">Servicios que vencen este mes</p>
          <p className="mt-2 font-display text-2xl font-bold tracking-tight text-gold-600">
            {servicesDueCount}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-ink/50">Días con gastos</p>
          <p className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">
            {byDay.size}
          </p>
        </div>
      </div>

      {isLoading ? (
        <PageSkeleton />
      ) : error ? (
        <QueryError error={error} onRetry={refetch} />
      ) : (
        <div className="card animate-fade-up overflow-hidden" style={{ animationDelay: '180ms' }}>
          <div className="grid grid-cols-7 border-b border-slate-100">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-ink/40"
              >
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} className="min-h-16 border border-slate-50 sm:min-h-20" />
              const iso = `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const isToday = iso === todayISO()
              const dayExpenses = byDay.get(iso) ?? []
              const due = servicesDueByDay.get(iso) ?? 0
              return (
                <button
                  key={iso}
                  data-testid={`day-${iso}`}
                  onClick={() => setSelectedDay(iso)}
                  className={cn(
                    'flex min-h-16 flex-col items-stretch gap-1 border border-slate-100 p-1 text-left transition-colors hover:bg-pine-50/60 sm:min-h-20 sm:p-1.5',
                    due > 0 && 'border-gold-200 bg-gold-100/60',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center self-start rounded-full text-xs font-medium',
                      isToday ? 'bg-pine-700 text-white' : 'text-ink/50',
                    )}
                  >
                    {day}
                  </span>
                  {dayExpenses.length > 0 && (
                    <p className="truncate text-xs font-semibold text-ink/70">
                      -{formatCurrency(dayTotal(iso))}
                    </p>
                  )}
                  {due > 0 && (
                    <p className="flex items-center gap-0.5 text-xs font-medium text-gold-600">
                      <Zap size={12} />
                      {due} servicio{due !== 1 && 's'}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <Modal
        open={!!selectedDay}
        title={selectedDay ? `${formatDate(selectedDay)} · ${monthLabel(month)}` : ''}
        onClose={() => setSelectedDay(null)}
      >
        {selectedDay && (
          <div className="space-y-4">
            <p className="text-lg font-semibold text-ink">
              Total del día: {formatCurrency(selectedTotal)}
            </p>

            {selectedServices.length > 0 && (
              <div className="rounded-xl border border-gold-200 bg-gold-100/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gold-600">
                  Vencen este día
                </p>
                <ul className="mt-1 space-y-1">
                  {selectedServices.map((s) => (
                    <li key={s.id} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-ink/70">
                        <Zap size={12} className="text-gold-600" />
                        {s.description || 'Sin nombre'}
                      </span>
                      <span className="font-medium text-ink/70">
                        {formatCurrency(Number(s.amount))}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-gold-600">
                  Recuerda aplicar los servicios pendientes desde la sección Servicios.
                </p>
              </div>
            )}

            {selected.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink/40">
                Sin gastos este día
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {selected.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {e.description || 'Sin descripción'}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-ink/50">
                        {e.category && (
                          <CategoryBadge name={e.category.name} color={e.category.color} />
                        )}
                        <span>{e.payer?.full_name || 'Sin asignar'}</span>
                      </div>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-ink">
                      -{formatCurrency(Number(e.amount))}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <button
              onClick={() => setFormDate(selectedDay)}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800"
            >
              <Plus size={16} />
              Agregar gasto de este día
            </button>
          </div>
        )}
      </Modal>

      <ExpenseForm
        open={!!formDate}
        initial={null}
        initialDate={formDate ?? undefined}
        onClose={() => setFormDate(null)}
        busy={addExpense.isPending}
        onSave={handleSave}
      />
    </div>
  )
}
