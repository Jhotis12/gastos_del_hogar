import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownCircle, ArrowUpCircle, Sparkles, AlertTriangle, Plus, Wallet, LayoutDashboard, PieChart, ReceiptText, Coins } from 'lucide-react'
import { useAuth } from '@/shared/hooks/useAuth'
import { useAddExpense } from '@/modules/expenses/hooks/useExpenses'
import { useCountUp } from '@/shared/hooks/useCountUp'
import { usePendingRecurring, useRecurringExpenses } from '@/modules/services/hooks/useRecurring'
import { useBudgets } from '@/modules/categories/hooks/useCategories'
import {
  useExpenses,
  useRunningBalance,
  useSummary,
  useMonthlySurpluses,
} from '@/modules/expenses/hooks/useExpenses'
import { useHousehold } from '@/modules/profile/hooks/useHousehold'
import { useMembers, useSalaries } from '@/modules/members/hooks/useMembers'
import ForecastWidget from '@/modules/dashboard/components/ForecastWidget'
import StatCard from '@/shared/components/ui/StatCard'
import EmptyState from '@/shared/components/ui/EmptyState'
import QueryError from '@/shared/components/ui/QueryError'
import Skeleton from '@/shared/components/ui/Skeleton'
import ExpenseForm from '@/modules/expenses/components/ExpenseForm'
import ApplyRecurringModal from '@/modules/services/components/ApplyRecurringModal'
import MonthPicker from '@/shared/components/ui/MonthPicker'
import CategoryBadge from '@/shared/components/ui/CategoryBadge'
import PageSkeleton from '@/shared/components/ui/PageSkeleton'
import { useToast } from '@/shared/components/ui/Toast'
import { cn, errorMessage } from '@/shared/lib/utils'
import {
  
  formatDate,
  monthLabel,
  shiftMonth,
  shortMonthLabel,
  todayISO,
} from '@/shared/lib/dates'
import { formatCurrency } from '@/shared/lib/money'

import { usePageTitle } from '@/shared/hooks/usePageTitle'
import { useMonthParam } from '@/shared/hooks/useMonthParam'

export default function Dashboard() {
  usePageTitle('Dashboard')
  const { user, profile } = useAuth()
  const [month, setMonth] = useMonthParam()
  const toast = useToast()
  const [quickOpen, setQuickOpen] = useState(false)
  const addExpense = useAddExpense()

  const handleQuickAdd = async (input: {
    amount: number
    description: string
    category_id: string | null
    paid_by: string | null
    expense_date: string
  }) => {
    try {
      await addExpense.mutateAsync(input)
      toast.success('Gasto registrado')
      setQuickOpen(false)
    } catch (err) {
      toast.error(errorMessage(err))
      throw err
    }
  }
  const { data: household, error: householdError, refetch: refetchHousehold } = useHousehold()
  const { data: members, error: membersError, refetch: refetchMembers } = useMembers()
  const { salaries, isPending: salariesPending } = useSalaries(month)
  const {
    data: expenses,
    isLoading: expensesLoading,
    error: expensesError,
    refetch: refetchExpenses,
  } = useExpenses(month)
  const { data: budgets } = useBudgets(month)
  const { totalIncome, totalExpenses } = useSummary(month)
  const {
    data: runningBalance,
    error: balanceError,
    refetch: refetchBalance,
  } = useRunningBalance(month)
  const {
    data: surpluses,
    error: surplusesError,
    refetch: refetchSurpluses,
  } = useMonthlySurpluses()
  const pendingRecurring = usePendingRecurring(month)
  const { data: recurring } = useRecurringExpenses()
  const balanceAnimated = useCountUp(runningBalance ?? 0)
  const [applyOpen, setApplyOpen] = useState(false)

  // Errores de queries: fallo visible con reintento en vez de secciones vacías
  const queryError = [householdError, membersError, expensesError, balanceError, surplusesError].find(Boolean)
  const retryAll = () => {
    void refetchHousehold()
    void refetchMembers()
    void refetchExpenses()
    void refetchBalance()
    void refetchSurpluses()
  }

  const paidIds = new Set<string>()
  for (const e of expenses ?? []) {
    if (e.recurring_id) paidIds.add(e.recurring_id)
  }
  const nextMonthStart = `${shiftMonth(month, 1).slice(0, 7)}-01`
  const applyable =
    recurring?.filter(
      (r) => r.is_active && r.next_due_date < nextMonthStart && !paidIds.has(r.id),
    ) ?? []

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

  const monthSurplus = totalIncome - totalExpenses
  const pendingSalaries = (salaries ?? []).filter((s) => s.pay_date > todayISO())
  const pendingLabel = pendingSalaries
    .map((s) => {
      const name = members?.find((m) => m.id === s.profile_id)?.full_name ?? 'Miembro'
      return `${formatCurrency(Number(s.amount))} (${name}, ${formatDate(s.pay_date)})`
    })
    .join(' · ')
  const monthList = (surpluses ?? []).slice(-6)
  const monthAccumulated = monthList.reduce((sum, s) => sum + s.surplus, 0)
  const idxCurrent = (surpluses ?? []).findIndex((s) => s.month === month)
  const currentSurplus = idxCurrent >= 0 ? (surpluses ?? [])[idxCurrent] : undefined
  const prevSurplus = idxCurrent > 0 ? (surpluses ?? [])[idxCurrent - 1] : undefined
  const deltaSurplus =
    currentSurplus && prevSurplus ? currentSurplus.surplus - prevSurplus.surplus : null

  if (!profile?.household_id) return null
  if (!household) return <PageSkeleton />

  return (
    <div className="space-y-6">
      <div className="animate-fade-up flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-ink">
            <LayoutDashboard size={24} className="text-pine-600" />
            Dashboard
          </h1>
          <p className="text-sm text-ink/50">
            {household.name} · {user?.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MonthPicker month={month} onChange={setMonth} />
          <button
            onClick={() => setQuickOpen(true)}
            aria-label="Agregar gasto rápido"
            title="Agregar gasto rápido"
            className="hidden h-11 w-11 items-center justify-center rounded-lg bg-pine-700 text-white shadow-md shadow-pine-900/20 transition-transform hover:bg-pine-800 active:scale-95 lg:flex"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {queryError && <QueryError error={queryError} onRetry={retryAll} />}

      <div className="animate-fade-up relative overflow-hidden rounded-2xl bg-gradient-to-br from-pine-700 via-pine-800 to-pine-950 p-5 text-white shadow-lg shadow-pine-900/20 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-400/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-14 left-1/3 h-40 w-40 rounded-full bg-pine-400/20 blur-2xl" />
        <div className="relative">
          <p className="text-sm font-medium text-pine-200">Saldo disponible · {monthLabel(month)}</p>
          <div
            data-testid="hero-saldo"
            className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-5xl"
          >
            {runningBalance === undefined ? (
              <Skeleton tone="onDark" className="mt-2 h-10 w-52 sm:h-14 sm:w-72" />
            ) : (
              formatCurrency(balanceAnimated)
            )}
          </div>
          <p className="mt-1 text-xs text-pine-200/80">
            Incluye el sobrante de meses anteriores
          </p>
          {pendingLabel && (
            <p className="mt-1 text-xs font-medium text-gold-300">
              Por llegar: {pendingLabel}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <StatCard
          label="Sobrante del mes"
          value={monthSurplus}
          icon={<Wallet size={20} />}
          tone={monthSurplus >= 0 ? 'positive' : 'negative'}
          delay={240}
        />
      </div>

      <div className="card card-hover animate-fade-up p-5" style={{ animationDelay: '400ms' }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-ink">Gastos recientes</h2>
          <Link
            to="/gastos"
            className="inline-flex min-h-11 items-center text-sm font-medium text-pine-600 hover:text-ink"
          >
            Ver todos
          </Link>
        </div>
        {expensesLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
        ) : !expenses || expenses.length === 0 ? (
          <EmptyState
            compact
            icon={<ReceiptText size={22} />}
            title="Sin gastos este mes"
            action={
              <button
                onClick={() => setQuickOpen(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800"
              >
                <Plus size={16} />
                Agregar gasto
              </button>
            }
          />
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
   
      {pendingRecurring > 0 && (
        <div className="animate-fade-up flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold-200 bg-gold-100/60 p-4">
          <p className="text-sm text-gold-600">
            <Sparkles size={16} className="mr-1 inline animate-pulse-soft" />
            Tienes {pendingRecurring} gasto{pendingRecurring !== 1 && 's'} fijo
            {pendingRecurring !== 1 && 's'} pendiente
            {pendingRecurring !== 1 && 's'} de aplicar este mes.
          </p>
          <button
            onClick={() => setApplyOpen(true)}
            className="inline-flex min-h-11 items-center rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800"
          >
            Aplicar recurrentes
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card card-hover animate-fade-up p-5" style={{ animationDelay: '220ms' }}>
          <h2 className="mb-4 font-display text-sm font-semibold text-ink">
            Gastos por categoría
          </h2>
          {expensesLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : categoriesSorted.length === 0 ? (
            <EmptyState
              compact
              icon={<PieChart size={22} />}
              title="Sin gastos registrados este mes"
              action={
                <button
                  onClick={() => setQuickOpen(true)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800"
                >
                  <Plus size={16} />
                  Agregar gasto
                </button>
              }
            />
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
              className="inline-flex min-h-11 items-center text-sm font-medium text-pine-600 hover:text-ink"
            >
              Gestionar
            </Link>
          </div>
          {salariesPending ? null : salaries.length === 0 ? (
            <EmptyState
              compact
              icon={<Wallet size={22} />}
              title="Aún no hay salarios registrados"
              action={
                <Link
                  to="/miembros"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800"
                >
                  Registrar salario
                </Link>
              }
            />
          ) : (
            <ul className="space-y-3">
              {salaries.map((s) => (
                <li
                  key={`${s.profile_id}-${s.pay_date}`}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2 text-ink/60">
                    <span className="truncate">
                      {members?.find((m) => m.id === s.profile_id)?.full_name ||
                        'Miembro'}
                    </span>
                    {s.source_month !== month && (
                      <span className="shrink-0 rounded-full bg-gold-100 px-2 py-0.5 text-xs font-medium text-gold-600">
                        Heredado
                      </span>
                    )}
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
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-semibold text-ink">
              Sobrantes por mes
            </h2>
            <p className="mt-0.5 text-xs text-ink/50">
              Acumulado (6 meses): {formatCurrency(monthAccumulated)}
              {deltaSurplus !== null && prevSurplus && (
                <span className="ml-2">
                  <span className={cn('font-medium', deltaSurplus >= 0 ? 'text-pine-600' : 'text-coral-600')}>
                    {deltaSurplus >= 0 ? '+' : '−'}
                    {formatCurrency(Math.abs(deltaSurplus))}
                  </span>{' '}
                  vs {shortMonthLabel(prevSurplus.month)}
                </span>
              )}
            </p>
          </div>
          <Link
            to="/historial"
            className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-pine-600 hover:text-ink"
          >
            Ver historial
          </Link>
        </div>
        {surpluses === undefined ? null : monthList.length === 0 ? (
          <EmptyState
            compact
            icon={<Coins size={22} />}
            title="Sin movimientos registrados"
            hint="Registra salarios o gastos para ver el sobrante por mes"
            action={
              <Link
                to="/gastos"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800"
              >
                Ver gastos
              </Link>
            }
          />
        ) : (
          <div className="flex snap-x gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-0">
            {monthList.map((s) => {
              const isCurrent = s.month === month
              const ratio = s.income > 0 ? s.surplus / s.income : 0
              return (
                <div
                  key={s.month}
                  className={cn(
                    'min-w-[9.5rem] snap-start rounded-xl border p-4 lg:min-w-0',
                    isCurrent
                      ? 'border-pine-200 bg-pine-50/40'
                      : 'border-slate-100 bg-cream/50',
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">
                      {shortMonthLabel(s.month)}
                    </p>
                    <p
                      className={cn(
                        'text-sm font-bold',
                        s.surplus >= 0 ? 'text-pine-600' : 'text-coral-600',
                      )}
                    >
                      {s.surplus >= 0 ? '+' : '−'}
                      {formatCurrency(Math.abs(s.surplus))}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-ink/50">
                    Ingresos {formatCurrency(s.income)} · Gastos{' '}
                    {formatCurrency(s.expenses)}
                  </p>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-cream">
                    <div
                      className={cn(
                        'animate-grow-bar h-full rounded-full',
                        s.surplus >= 0 ? 'bg-pine-500' : 'bg-coral-500',
                      )}
                      style={{ width: `${Math.max(4, Math.min(100, ratio * 100))}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-ink/50">
                    Ahorro {s.income > 0 ? Math.round(ratio * 100) : 0}% de los
                    ingresos
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ForecastWidget />

      <ExpenseForm
        open={quickOpen}
        initial={null}
        onClose={() => setQuickOpen(false)}
        busy={addExpense.isPending}
        onSave={handleQuickAdd}
      />

      <ApplyRecurringModal
        open={applyOpen}
        month={month}
        pending={applyable}
        onClose={() => setApplyOpen(false)}
      />

    </div>
  )
}
