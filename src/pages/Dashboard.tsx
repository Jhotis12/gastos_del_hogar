import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownCircle, ArrowUpCircle, Sparkles, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCountUp } from '@/hooks/useCountUp'
import { useApplyRecurring, usePendingRecurring } from '@/hooks/useRecurring'
import { useBudgets } from '@/hooks/useCategories'
import { useExpenses, useSummary } from '@/hooks/useExpenses'
import { useHousehold } from '@/hooks/useHousehold'
import { useMembers, useSalaries } from '@/hooks/useMembers'
import StatCard from '@/components/ui/StatCard'
import MonthPicker from '@/components/ui/MonthPicker'
import CategoryBadge from '@/components/ui/CategoryBadge'
import Loading from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/utils'
import { currentMonthKey, formatDate, monthLabel } from '@/lib/dates'
import { formatCurrency } from '@/lib/money'

export default function Dashboard() {
  const { user, profile } = useAuth()
  const [month, setMonth] = useState(currentMonthKey())
  const toast = useToast()
  const { data: household } = useHousehold()
  const { data: members } = useMembers()
  const { data: salaries } = useSalaries(month)
  const { data: expenses } = useExpenses(month)
  const { data: budgets } = useBudgets(month)
  const { totalIncome, totalExpenses, balance } = useSummary(month)
  const pendingRecurring = usePendingRecurring(month)
  const applyRecurring = useApplyRecurring(month)
  const balanceAnimated = useCountUp(balance)

  const handleApplyRecurring = async () => {
    try {
      const count = await applyRecurring.mutateAsync()
      toast.success(
        count > 0
          ? `${count} gasto${count !== 1 ? 's' : ''} recurrente${count !== 1 ? 's' : ''} aplicado${count !== 1 ? 's' : ''}`
          : 'No había recurrentes pendientes',
      )
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const byCategory = new Map<
    string,
    { name: string; color: string; total: number; budget?: number }
  >()
  const budgetMap = new Map(budgets?.map((b) => [b.category_id, Number(b.amount)]))
  for (const e of expenses ?? []) {
    const cat = e.category
    const key = cat?.id ?? 'sin-categoria'
    const current = byCategory.get(key) ?? {
      name: cat?.name ?? 'Sin categoría',
      color: cat?.color ?? '#94a3b8',
      total: 0,
    }
    current.total += Number(e.amount)
    current.budget = current.budget ?? budgetMap.get(key)
    byCategory.set(key, current)
  }
  const categoriesSorted = [...byCategory.values()].sort((a, b) => b.total - a.total)
  const maxCategory = categoriesSorted[0]?.total ?? 1

  if (!profile?.household_id) return null
  if (!household) return <Loading />

  return (
    <div className="space-y-6">
      <div className="animate-fade-up flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Dashboard
          </h1>
          <p className="text-sm text-ink/50">
            {household.name} · {user?.email}
          </p>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      <div className="animate-fade-up relative overflow-hidden rounded-2xl bg-gradient-to-br from-pine-700 via-pine-800 to-pine-950 p-5 text-white shadow-lg shadow-pine-900/20 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-400/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-14 left-1/3 h-40 w-40 rounded-full bg-pine-400/20 blur-2xl" />
        <div className="relative">
          <p className="text-sm font-medium text-pine-200">Saldo disponible · {monthLabel(month)}</p>
          <p className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-5xl">
            {formatCurrency(balanceAnimated)}
          </p>
          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <span className="flex items-center gap-2 text-pine-100">
              <ArrowUpCircle size={16} className="text-emerald-300" />
              Ingresos {formatCurrency(totalIncome)}
            </span>
            <span className="flex items-center gap-2 text-pine-100">
              <ArrowDownCircle size={16} className="text-coral-300" />
              Gastos {formatCurrency(totalExpenses)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Ingresos del mes"
          value={totalIncome}
          icon={<ArrowUpCircle size={20} />}
          tone="positive"
          delay={80}
        />
        <StatCard
          label="Gastos del mes"
          value={totalExpenses}
          icon={<ArrowDownCircle size={20} />}
          tone="negative"
          delay={160}
        />
      </div>

      {pendingRecurring > 0 && (
        <div className="animate-fade-up flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold-200 bg-gold-100/60 p-4">
          <p className="text-sm text-gold-700">
            <Sparkles size={16} className="mr-1 inline animate-pulse-soft" />
            Tienes {pendingRecurring} gasto{pendingRecurring !== 1 && 's'} fijo
            {pendingRecurring !== 1 && 's'} pendiente
            {pendingRecurring !== 1 && 's'} de aplicar este mes.
          </p>
          <button
            onClick={handleApplyRecurring}
            disabled={applyRecurring.isPending}
            className="rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800 disabled:opacity-50"
          >
            {applyRecurring.isPending ? 'Aplicando…' : 'Aplicar recurrentes'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card card-hover animate-fade-up p-5" style={{ animationDelay: '220ms' }}>
          <h2 className="mb-4 font-display text-sm font-semibold text-ink">
            Gastos por categoría
          </h2>
          {categoriesSorted.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink/40">
              Sin gastos registrados este mes
            </p>
          ) : (
            <div className="space-y-3">
              {categoriesSorted.map((c) => {
                const ratio = c.budget ? c.total / c.budget : null
                return (
                  <div key={c.name}>
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-1 text-sm">
                      <CategoryBadge name={c.name} color={c.color} />
                      <span className="font-medium text-ink/80">
                        {formatCurrency(c.total)}
                        {c.budget && (
                          <span className="ml-1 text-xs font-normal text-ink/40">
                            / {formatCurrency(c.budget)}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-cream">
                      <div
                        className="animate-grow-bar h-full rounded-full"
                        style={{
                          width: `${Math.max(4, (c.total / maxCategory) * 100)}%`,
                          backgroundColor: c.color,
                          animationDelay: `${250 + categoriesSorted.indexOf(c) * 70}ms`,
                        }}
                      />
                    </div>
                    {ratio !== null && (
                      <div className="mt-1">
                        {ratio > 1 ? (
                          <p className="flex items-center gap-1 text-xs font-medium text-coral-600">
                            <AlertTriangle size={12} />
                            Sobre el presupuesto en {Math.round((ratio - 1) * 100)}%
                          </p>
                        ) : (
                          <div className="h-1.5 overflow-hidden rounded-full bg-cream">
                            <div
                              className={`animate-grow-bar h-full rounded-full ${
                                ratio > 0.7 ? 'bg-gold-500' : 'bg-pine-500'
                              }`}
                              style={{ width: `${Math.min(100, ratio * 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card card-hover animate-fade-up p-5" style={{ animationDelay: '280ms' }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-ink">Salarios del mes</h2>
            <Link
              to="/miembros"
              className="text-sm font-medium text-pine-600 hover:text-pine-700"
            >
              Gestionar
            </Link>
          </div>
          {!salaries || salaries.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink/40">
              Aún no hay salarios registrados
            </p>
          ) : (
            <ul className="space-y-3">
              {salaries.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-ink/60">
                    {members?.find((m) => m.id === s.profile_id)?.full_name ||
                      'Miembro'}
                  </span>
                  <span className="font-semibold text-pine-600">
                    +{formatCurrency(Number(s.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card card-hover animate-fade-up p-5" style={{ animationDelay: '340ms' }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-ink">Gastos recientes</h2>
          <Link
            to="/gastos"
            className="text-sm font-medium text-pine-600 hover:text-pine-700"
          >
            Ver todos
          </Link>
        </div>
        {!expenses || expenses.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink/40">
            Sin gastos este mes
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {expenses.slice(0, 6).map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 py-3"
              >
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
                <div className="text-right">
                  <p className="text-sm font-semibold text-ink">
                    -{formatCurrency(Number(e.amount))}
                  </p>
                  <p className="text-xs text-ink/40">
                    {formatDate(e.expense_date)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
