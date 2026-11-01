import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  Home,
  PiggyBank,
  Plus,
  ReceiptText,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '@/shared/hooks/useAuth'
import { useAddExpense, useExpenses } from '@/modules/expenses/hooks/useExpenses'
import { useCountUp } from '@/shared/hooks/useCountUp'
import { usePendingRecurring, useRecurringExpenses } from '@/modules/services/hooks/useRecurring'
import { useHousehold } from '@/modules/profile/hooks/useHousehold'
import { useMembers } from '@/modules/members/hooks/useMembers'
import { useFinanceWindow } from '@/modules/finance/hooks/useFinanceWindow'
import { useMemberAvailable } from '@/modules/finance/hooks/useMemberAvailable'
import { useHouseholdAvailable } from '@/modules/finance/hooks/useHouseholdAvailable'
import { useSavingsMovements } from '@/modules/savings/hooks/useSavingsMovements'
import {
  householdReconciliation,
  householdTotal,
  payerBreakdown,
} from '@/modules/finance/lib/ledger'
import ExpenseForm from '@/modules/expenses/components/ExpenseForm'
import ApplyRecurringModal from '@/modules/services/components/ApplyRecurringModal'
import MonthPicker from '@/shared/components/ui/MonthPicker'
import CategoryBadge from '@/shared/components/ui/CategoryBadge'
import PageSkeleton from '@/shared/components/ui/PageSkeleton'
import EmptyState from '@/shared/components/ui/EmptyState'
import QueryError from '@/shared/components/ui/QueryError'
import Skeleton from '@/shared/components/ui/Skeleton'
import { useToast } from '@/shared/components/ui/Toast'
import { cn, errorMessage } from '@/shared/lib/utils'
import { formatCurrency } from '@/shared/lib/money'
import {
  formatDate,
  monthLabel,
  shiftMonth,
  todayISO,
} from '@/shared/lib/dates'
import { rangeLabel } from '@/shared/lib/periods'
import { usePageTitle } from '@/shared/hooks/usePageTitle'
import Fab from '@/shared/components/ui/Fab'
import { useMonthParam } from '@/shared/hooks/useMonthParam'
import { OFFLINE_QUEUED } from '@/shared/lib/offline/offlineSafe'

function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end
}

export default function Dashboard() {
  usePageTitle('Inicio')
  const { user, profile } = useAuth()
  const [month, setMonth] = useMonthParam()
  const toast = useToast()
  const [quickOpen, setQuickOpen] = useState(false)
  const [applyOpen, setApplyOpen] = useState(false)
  const addExpense = useAddExpense()
  const asOf = todayISO()

  const { data: household, error: householdError, refetch: refetchHousehold } = useHousehold()
  const { data: members, error: membersError, refetch: refetchMembers } = useMembers()
  const {
    data: finance,
    isPending: financePending,
    error: financeError,
    refetch: refetchFinance,
    window: financeWindows,
  } = useFinanceWindow(asOf)
  const {
    data: memberAvailable,
    isPending: availablePending,
    error: availableError,
    refetch: refetchAvailable,
  } = useMemberAvailable(asOf)
  const {
    data: householdAvailableData,
    isPending: householdAvailablePending,
    error: householdAvailableError,
    refetch: refetchHouseholdAvailable,
  } = useHouseholdAvailable(asOf)
  const {
    data: savingsMovements,
    error: savingsError,
    refetch: refetchSavings,
  } = useSavingsMovements()
  const {
    data: householdExpenses,
    isLoading: householdLoading,
    error: expensesError,
    refetch: refetchExpenses,
  } = useExpenses(month)

  const pendingRecurring = usePendingRecurring(month)
  const { data: recurring } = useRecurringExpenses()

  const handleQuickAdd = async (input: {
    amount: number
    description: string
    category_id: string | null
    paid_by: string | null
    expense_date: string
  }) => {
    try {
      const res = await addExpense.mutateAsync(input)
      if (res !== OFFLINE_QUEUED) toast.success('Gasto registrado')
      setQuickOpen(false)
    } catch (err) {
      toast.error(errorMessage(err))
      throw err
    }
  }

  const queryError = [
    householdError,
    membersError,
    financeError,
    availableError,
    householdAvailableError,
    savingsError,
    expensesError,
  ].find(Boolean)
  const retryAll = () => {
    void refetchHousehold()
    void refetchMembers()
    void refetchFinance()
    void refetchAvailable()
    void refetchHouseholdAvailable()
    void refetchSavings()
    void refetchExpenses()
  }

  const personalExpenses = finance?.expenses ?? []
  const monthExpenses = personalExpenses.filter((expense) =>
    inRange(expense.expense_date, financeWindows.month.start, financeWindows.month.end),
  )
  const cycleExpenses = personalExpenses.filter((expense) =>
    inRange(expense.expense_date, financeWindows.cycle.start, financeWindows.cycle.end),
  )
  const monthSpent = monthExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0)
  const cycleSpent = cycleExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0)
  const savingsThisCycle = (savingsMovements ?? [])
    .filter(
      (movement) =>
        movement.member_id === profile?.id &&
        inRange(movement.movement_date, financeWindows.cycle.start, financeWindows.cycle.end),
    )
    .reduce((sum, movement) => sum + Number(movement.amount), 0)

  const available = memberAvailable?.available ?? null
  const availableAnimated = useCountUp(available ?? 0)
  const householdAvailable = householdAvailableData?.available ?? null
  const householdAvailableAnimated = useCountUp(householdAvailable ?? 0)

  const homeExpenses = householdExpenses ?? []
  const homeTotal = householdTotal(homeExpenses)
  const homeBreakdown = payerBreakdown(homeExpenses)
  const homeReconciliation = householdReconciliation(homeExpenses)
  const memberName = (memberId: string | null) =>
    memberId === null
      ? 'Sin asignar'
      : members?.find((member) => member.id === memberId)?.full_name || 'Miembro'

  const paidIds = new Set<string>()
  for (const expense of homeExpenses) {
    if (expense.recurring_id) paidIds.add(expense.recurring_id)
  }
  const nextMonthStart = `${shiftMonth(month, 1).slice(0, 7)}-01`
  const applyable =
    recurring?.filter(
      (item) => item.is_active && item.next_due_date < nextMonthStart && !paidIds.has(item.id),
    ) ?? []

  if (!profile?.household_id) return null
  if (!household) {
    if (householdError) {
      return (
        <div className="space-y-6">
          <QueryError error={householdError} onRetry={retryAll} />
        </div>
      )
    }
    return <PageSkeleton />
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-up flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-ink">
            <Home size={24} className="text-pine-600" />
            Inicio
          </h1>
          <p className="text-sm text-ink/50">
            {household.name} · {user?.email}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
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

      <section className="animate-fade-up relative overflow-hidden rounded-2xl bg-gradient-to-br from-pine-700 via-pine-800 to-pine-950 p-5 text-white shadow-lg shadow-pine-900/20 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-400/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-14 left-1/3 h-40 w-40 rounded-full bg-pine-400/20 blur-2xl" />
        <div className="relative">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1.35fr_1fr]">
            <div>
              <p className="text-sm font-medium text-pine-200">
                Disponible personal · desde tu último pago
              </p>
              <div
                data-testid="hero-saldo"
                className={cn(
                  'mt-1 font-display text-3xl font-bold tracking-tight sm:text-5xl',
                  available !== null && available < 0 && 'text-coral-200',
                )}
              >
                {availablePending || financePending ? (
                  <Skeleton tone="onDark" className="mt-2 h-10 w-52 sm:h-14 sm:w-72" />
                ) : available === null ? (
                  <span className="text-2xl font-semibold">Sin base de ingresos</span>
                ) : (
                  formatCurrency(availableAnimated)
                )}
              </div>
              <p className="mt-1 text-xs text-pine-200/80">
                Ingresos − gastos − ahorro desde tu último pago
              </p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <p className="flex items-center gap-1.5 text-xs font-medium text-pine-200">
                <Users size={14} /> Disponible del hogar
              </p>
              <div
                data-testid="hero-hogar"
                className={cn(
                  'mt-1 font-display text-2xl font-bold tracking-tight',
                  householdAvailable !== null && householdAvailable < 0 && 'text-coral-200',
                )}
              >
                {householdAvailablePending ? (
                  <Skeleton tone="onDark" className="mt-1 h-8 w-36" />
                ) : householdAvailable === null ? (
                  <span className="text-lg font-semibold">Sin movimientos</span>
                ) : (
                  formatCurrency(householdAvailableAnimated)
                )}
              </div>
              <p className="mt-1 text-[11px] text-pine-200/70">
                Suma de los disponibles personales
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
              <p className="flex items-center gap-1.5 text-xs font-medium text-pine-200">
                <CalendarDays size={14} /> Mi mes
              </p>
              <div className="mt-1 font-display text-xl font-semibold">
                {financePending ? <Skeleton tone="onDark" className="h-6 w-24" /> : formatCurrency(monthSpent)}
              </div>
              <p className="mt-0.5 text-[11px] text-pine-200/70">
                {rangeLabel(financeWindows.month)}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
              <p className="flex items-center gap-1.5 text-xs font-medium text-pine-200">
                <Wallet size={14} /> Gastos desde mi último pago
              </p>
              <div className="mt-1 font-display text-xl font-semibold">
                {financePending ? <Skeleton tone="onDark" className="h-6 w-24" /> : formatCurrency(cycleSpent)}
              </div>
              <p className="mt-0.5 text-[11px] text-pine-200/70">
                {rangeLabel(financeWindows.cycle)}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
              <p className="flex items-center gap-1.5 text-xs font-medium text-pine-200">
                <PiggyBank size={14} /> Mi ahorro
              </p>
              <div
                className={cn(
                  'mt-1 font-display text-xl font-semibold',
                  savingsThisCycle < 0 && 'text-coral-200',
                )}
              >
                {savingsThisCycle >= 0 ? '' : '−'}
                {formatCurrency(Math.abs(savingsThisCycle))}
              </div>
              <p className="mt-0.5 text-[11px] text-pine-200/70">
                {rangeLabel(financeWindows.cycle)}
              </p>
            </div>
          </div>
        </div>
      </section>

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
        <section className="card card-hover animate-fade-up p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-ink">Mis gastos recientes</h2>
            <Link
              to="/gastos"
              className="inline-flex min-h-11 items-center text-sm font-medium text-pine-600 hover:text-ink"
            >
              Ver todos
            </Link>
          </div>
          {financePending ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          ) : personalExpenses.length === 0 ? (
            <EmptyState
              compact
              icon={<ReceiptText size={22} />}
              title="Sin gastos tuyos en esta ventana"
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
              {personalExpenses.slice(0, 6).map((expense) => (
                <li key={expense.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {expense.description || 'Sin descripción'}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-ink/50">
                      {expense.category && (
                        <CategoryBadge
                          name={expense.category.name}
                          color={expense.category.color}
                        />
                      )}
                      <span>{expense.payer?.full_name || 'Sin asignar'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="whitespace-nowrap text-sm font-semibold text-ink">
                      -{formatCurrency(Number(expense.amount))}
                    </p>
                    <p className="text-xs text-ink/40">{formatDate(expense.expense_date)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card card-hover animate-fade-up p-5" style={{ animationDelay: '120ms' }}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
                <Users size={16} className="text-pine-600" /> Hogar
              </h2>
              <p className="mt-0.5 text-xs text-ink/50">{monthLabel(month)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Link
                to="/historial"
                className="inline-flex min-h-11 items-center text-sm font-medium text-ink/55 hover:text-ink"
              >
                Historial
              </Link>
              <Link
                to="/gastos"
                className="inline-flex min-h-11 items-center text-sm font-medium text-pine-600 hover:text-ink"
              >
                Ver gastos
              </Link>
            </div>
          </div>

          {householdLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          ) : homeExpenses.length === 0 ? (
            <EmptyState
              compact
              icon={<Users size={22} />}
              title="Sin gastos del hogar este mes"
              hint="Cuando cualquiera registre un gasto, aparecerá aquí."
            />
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink/40">
                  Total del mes
                </p>
                <p className="font-display text-2xl font-bold text-ink">
                  {formatCurrency(homeTotal)}
                </p>
              </div>
              <ul className="mt-4 space-y-2.5">
                {homeBreakdown.map((row) => (
                  <li
                    key={row.memberId ?? 'unassigned'}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-ink/60">
                      <span
                        className={cn(
                          'h-2 w-2 shrink-0 rounded-full',
                          row.memberId === null ? 'bg-gold-500' : 'bg-pine-500',
                        )}
                      />
                      <span className="truncate">{memberName(row.memberId)}</span>
                    </span>
                    <span className="font-medium text-ink/80">{formatCurrency(row.total)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-ink/50">
                {homeReconciliation.unassigned > 0
                  ? `Sin asignar: ${formatCurrency(homeReconciliation.unassigned)} · `
                  : ''}
                La suma por persona coincide con el total del hogar.
              </p>
            </>
          )}
        </section>
      </div>

      <Fab onClick={() => setQuickOpen(true)} label="Agregar gasto" />

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
