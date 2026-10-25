import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  History as HistoryIcon,
  Plus,
  Wallet,
} from 'lucide-react'
import { useHouseholdMonthlyHistory } from '@/modules/finance/hooks/useHouseholdMonthlyHistory'
import { usePersonalMonthlyHistory } from '@/modules/finance/hooks/usePersonalMonthlyHistory'
import StatCard from '@/shared/components/ui/StatCard'
import PageSkeleton from '@/shared/components/ui/PageSkeleton'
import QueryError from '@/shared/components/ui/QueryError'
import EmptyState from '@/shared/components/ui/EmptyState'
import { cn } from '@/shared/lib/utils'
import { monthLabel } from '@/shared/lib/dates'
import { formatCurrency } from '@/shared/lib/money'

import { usePageTitle } from '@/shared/hooks/usePageTitle'

function signedCurrency(value: number): string {
  if (value === 0) return formatCurrency(0)
  return `${value < 0 ? '−' : '+'}${formatCurrency(Math.abs(value))}`
}

export default function History() {
  usePageTitle('Historial')
  const [view, setView] = useState<'hogar' | 'personal'>('hogar')
  const householdQuery = useHouseholdMonthlyHistory()
  const personalQuery = usePersonalMonthlyHistory()
  const history = view === 'hogar' ? householdQuery.data : personalQuery.data
  const isLoading = view === 'hogar' ? householdQuery.isLoading : personalQuery.isLoading
  const error = view === 'hogar' ? householdQuery.error : personalQuery.error
  const refetch = view === 'hogar' ? householdQuery.refetch : personalQuery.refetch

  const rows = history ?? []

  const totalIncome = rows.reduce((sum, row) => sum + row.income, 0)
  const totalExpenses = rows.reduce((sum, row) => sum + row.expenses, 0)
  const totalRemaining = totalIncome - totalExpenses

  if (isLoading) return <PageSkeleton />
  if (error) return <QueryError error={error} onRetry={refetch} />

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-ink">
          <HistoryIcon size={24} className="text-pine-600" />
          Historial
        </h1>
        <p className="text-sm text-ink/50">
          Dinero recibido, gastado y lo que quedó, mes a mes.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Vista del historial"
        className="inline-flex rounded-full bg-cream p-1 ring-1 ring-ink/5"
      >
        <button
          role="tab"
          aria-selected={view === 'hogar'}
          onClick={() => setView('hogar')}
          className={cn(
            'min-h-10 rounded-full px-4 py-2 text-sm font-medium transition-colors',
            view === 'hogar' ? 'bg-ink text-cream' : 'text-ink/55 hover:text-ink',
          )}
        >
          Hogar
        </button>
        <button
          role="tab"
          aria-selected={view === 'personal'}
          onClick={() => setView('personal')}
          className={cn(
            'min-h-10 rounded-full px-4 py-2 text-sm font-medium transition-colors',
            view === 'personal' ? 'bg-ink text-cream' : 'text-ink/55 hover:text-ink',
          )}
        >
          Mis meses
        </button>
      </div>

      <p className="text-xs text-ink/45">
        {view === 'hogar'
          ? 'Incluye todos los ingresos y gastos del hogar.'
          : 'Incluye solo tus ingresos y gastos.'}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Recibido"
          value={totalIncome}
          icon={<ArrowUpCircle size={20} />}
          tone="positive"
          delay={60}
          hint="Salarios e ingresos extra del período."
        />
        <StatCard
          label="Gastado"
          value={totalExpenses}
          icon={<ArrowDownCircle size={20} />}
          tone="negative"
          delay={120}
          hint="Gastos pagados en el período."
        />
        <StatCard
          label="Quedó"
          value={totalRemaining}
          icon={<Wallet size={20} />}
          tone={totalRemaining >= 0 ? 'positive' : 'negative'}
          delay={180}
          hint="Recibido − gastado."
        />
      </div>

      <div
        className="card card-hover animate-fade-up overflow-hidden"
        style={{ animationDelay: '220ms' }}
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon size={22} />}
            title="Aún no hay movimientos registrados"
            hint={
              view === 'personal'
                ? 'Tus meses aparecen cuando registras ingresos o gastos'
                : 'Los meses aparecen cuando el hogar registra salarios, ingresos o gastos'
            }
            action={
              <Link
                to="/gastos"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800"
              >
                <Plus size={16} />
                Registrar gasto
              </Link>
            }
          />
        ) : (
          <>
            <div className="divide-y divide-slate-100 md:hidden">
              {rows.map((row) => {
                const remaining = row.income - row.expenses
                return (
                  <div key={row.month} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-ink">
                        {monthLabel(row.month)}
                      </p>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wide text-ink/40">
                          Quedó
                        </p>
                        <p
                          className={cn(
                            'text-sm font-bold',
                            remaining >= 0 ? 'text-pine-600' : 'text-coral-600',
                          )}
                        >
                          {signedCurrency(remaining)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-ink/40">Recibido</p>
                        <p className="text-sm font-medium text-ink/70">
                          {formatCurrency(row.income)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-ink/40">Gastado</p>
                        <p className="text-sm font-medium text-ink/70">
                          {formatCurrency(row.expenses)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-ink/40">
                    <th className="px-5 py-3 font-medium">Mes</th>
                    <th className="px-5 py-3 text-right font-medium">Recibido</th>
                    <th className="px-5 py-3 text-right font-medium">Gastado</th>
                    <th className="px-5 py-3 text-right font-medium">Quedó</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const remaining = row.income - row.expenses
                    return (
                      <tr key={row.month}>
                        <td className="px-5 py-3 font-medium text-ink">
                          {monthLabel(row.month)}
                        </td>
                        <td className="px-5 py-3 text-right text-ink/70">
                          {formatCurrency(row.income)}
                        </td>
                        <td className="px-5 py-3 text-right text-ink/70">
                          {formatCurrency(row.expenses)}
                        </td>
                        <td
                          className={cn(
                            'px-5 py-3 text-right font-semibold',
                            remaining >= 0 ? 'text-pine-600' : 'text-coral-600',
                          )}
                        >
                          {signedCurrency(remaining)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-100 bg-cream/60 font-medium text-ink">
                    <td className="px-5 py-3">Totales</td>
                    <td className="px-5 py-3 text-right">
                      {formatCurrency(totalIncome)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {formatCurrency(totalExpenses)}
                    </td>
                    <td
                      className={cn(
                        'px-5 py-3 text-right',
                        totalRemaining >= 0 ? 'text-pine-600' : 'text-coral-600',
                      )}
                    >
                      {signedCurrency(totalRemaining)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
