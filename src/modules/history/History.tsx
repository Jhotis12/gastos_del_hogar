import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  HelpCircle,
  History as HistoryIcon,
  PiggyBank,
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
  const totalSavings = rows.reduce((sum, row) => sum + row.savings, 0)
  const totalWithSavings = totalIncome - totalExpenses
  const totalFree = totalWithSavings - totalSavings
  const finalAccumulated = rows.at(-1)?.accumulated ?? 0

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
          {view === 'hogar'
            ? 'Ingresos, gastos y ahorro del hogar, mes a mes.'
            : 'Tus ingresos, tus gastos y tus aportes a metas, mes a mes.'}
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

      <p className="text-xs leading-relaxed text-ink/45">
        {view === 'hogar'
          ? 'Incluye todos los ingresos y gastos del hogar. El ahorro son las metas compartidas.'
          : 'Incluye solo tus ingresos y gastos. El ahorro es lo que aportaste tú, aunque la meta sea compartida.'}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total con ahorros"
          value={totalWithSavings}
          icon={<Wallet size={20} />}
          tone={totalWithSavings >= 0 ? 'positive' : 'negative'}
          delay={60}
          hint="Ingresos − gastos. Incluye lo que está en metas."
        />
        <StatCard
          label="Ahorro"
          value={totalSavings}
          icon={<PiggyBank size={20} />}
          tone="default"
          delay={120}
          hint="Lo apartado en el período; no es un gasto."
        />
        <StatCard
          label="Acumulado después del ahorro"
          value={finalAccumulated}
          icon={<Wallet size={20} />}
          tone={finalAccumulated >= 0 ? 'positive' : 'negative'}
          delay={180}
          hint="Caja libre después de apartar el ahorro."
        />
      </div>

      <div className="card animate-fade-up p-4" style={{ animationDelay: '220ms' }}>
        <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <HelpCircle size={16} className="text-pine-600" />
          Cómo leer estas cifras
        </p>
        <div className="mt-2 grid gap-1 text-xs leading-relaxed text-ink/60 sm:grid-cols-3">
          <p>
            <span className="font-semibold text-ink/75">Total con ahorros</span> =
            ingresos − gastos. Es el dinero que te queda, esté en caja o en metas.
          </p>
          <p>
            <span className="font-semibold text-ink/75">Libre</span> = total con
            ahorros − ahorro del mes.
          </p>
          <p>
            <span className="font-semibold text-ink/75">Acumulado</span> = suma de
            libre de todos los meses.
          </p>
        </div>
        <p className="mt-2 text-[11px] text-ink/40">
          El ahorro no es un gasto. Los ajustes de saldo histórico aparecen como
          gastos o ingresos de normalización.
        </p>
      </div>

      <div
        className="card card-hover animate-fade-up overflow-hidden"
        style={{ animationDelay: '260ms' }}
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon size={22} />}
            title="Aún no hay movimientos registrados"
            hint={
              view === 'personal'
                ? 'Tus meses aparecen cuando registras gastos, ingresos o ahorro'
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
                const total = row.income - row.expenses
                return (
                  <div key={row.month} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-ink">
                        {monthLabel(row.month)}
                      </p>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wide text-ink/40">
                          Total con ahorros
                        </p>
                        <p
                          className={cn(
                            'text-sm font-bold',
                            total >= 0 ? 'text-pine-600' : 'text-coral-600',
                          )}
                        >
                          {signedCurrency(total)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-xs text-ink/40">Ingresos</p>
                        <p className="text-sm font-medium text-ink/70">
                          {formatCurrency(row.income)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-ink/40">Gastos</p>
                        <p className="text-sm font-medium text-ink/70">
                          {formatCurrency(row.expenses)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-ink/40">Ahorro</p>
                        <p className="text-sm font-medium text-ink/70">
                          {formatCurrency(row.savings)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2">
                      <div>
                        <p className="text-xs text-ink/40">Libre</p>
                        <p
                          className={cn(
                            'text-sm font-medium',
                            row.free >= 0 ? 'text-pine-600' : 'text-coral-600',
                          )}
                        >
                          {signedCurrency(row.free)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-ink/40">Acumulado</p>
                        <p
                          className={cn(
                            'text-sm font-medium',
                            row.accumulated >= 0 ? 'text-ink/70' : 'text-coral-600',
                          )}
                        >
                          {signedCurrency(row.accumulated)}
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
                    <th className="px-5 py-3 text-right font-medium">Ingresos</th>
                    <th className="px-5 py-3 text-right font-medium">Gastos</th>
                    <th className="px-5 py-3 text-right font-medium">Ahorro</th>
                    <th
                      className="px-5 py-3 text-right font-medium"
                      title="Ingresos menos gastos: el dinero que queda, incluyendo lo ahorrado"
                    >
                      Total con ahorros
                    </th>
                    <th
                      className="px-5 py-3 text-right font-medium"
                      title="Total con ahorros menos el ahorro del mes"
                    >
                      Libre
                    </th>
                    <th
                      className="px-5 py-3 text-right font-medium"
                      title="Suma de libre de todos los meses"
                    >
                      Acumulado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const total = row.income - row.expenses
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
                        <td className="px-5 py-3 text-right text-ink/60">
                          {formatCurrency(row.savings)}
                        </td>
                        <td
                          className={cn(
                            'px-5 py-3 text-right font-semibold',
                            total >= 0 ? 'text-pine-600' : 'text-coral-600',
                          )}
                        >
                          {signedCurrency(total)}
                        </td>
                        <td
                          className={cn(
                            'px-5 py-3 text-right font-semibold',
                            row.free >= 0 ? 'text-pine-600' : 'text-coral-600',
                          )}
                        >
                          {signedCurrency(row.free)}
                        </td>
                        <td
                          className={cn(
                            'px-5 py-3 text-right font-medium',
                            row.accumulated >= 0 ? 'text-ink/70' : 'text-coral-600',
                          )}
                        >
                          {signedCurrency(row.accumulated)}
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
                    <td className="px-5 py-3 text-right">
                      {formatCurrency(totalSavings)}
                    </td>
                    <td
                      className={cn(
                        'px-5 py-3 text-right',
                        totalWithSavings >= 0 ? 'text-pine-600' : 'text-coral-600',
                      )}
                    >
                      {signedCurrency(totalWithSavings)}
                    </td>
                    <td
                      className={cn(
                        'px-5 py-3 text-right',
                        totalFree >= 0 ? 'text-pine-600' : 'text-coral-600',
                      )}
                    >
                      {signedCurrency(totalFree)}
                    </td>
                    <td
                      className={cn(
                        'px-5 py-3 text-right',
                        finalAccumulated >= 0 ? 'text-ink/70' : 'text-coral-600',
                      )}
                    >
                      {signedCurrency(finalAccumulated)}
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
