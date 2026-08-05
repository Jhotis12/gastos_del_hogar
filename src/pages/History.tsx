import { Link } from 'react-router-dom'
import { ArrowDownCircle, ArrowUpCircle, Wallet, History as HistoryIcon, Plus } from 'lucide-react'
import { useMonthlySurpluses } from '@/hooks/useExpenses'
import StatCard from '@/components/ui/StatCard'
import PageSkeleton from '@/components/ui/PageSkeleton'
import QueryError from '@/components/ui/QueryError'
import EmptyState from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'
import { monthLabel } from '@/lib/dates'
import { formatCurrency } from '@/lib/money'

export default function History() {
  const { data: surpluses, isLoading, error, refetch } = useMonthlySurpluses()

  const rows = (surpluses ?? []).map((s, i) => ({
    ...s,
    accumulated: (surpluses ?? []).reduce(
      (sum, x, j) => (j <= i ? sum + x.surplus : sum),
      0,
    ),
  }))

  const totalIncome = rows.reduce((sum, r) => sum + r.income, 0)
  const totalExpenses = rows.reduce((sum, r) => sum + r.expenses, 0)
  const finalAccumulated = rows.length > 0 ? rows[rows.length - 1].accumulated : 0

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
          Sobrantes por mes: cuánto quedó libre de cada mes, mes a mes
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Ahorro acumulado"
          value={finalAccumulated}
          icon={<Wallet size={20} />}
          tone={finalAccumulated >= 0 ? 'positive' : 'negative'}
          delay={60}
        />
        <StatCard
          label="Ingresos del período"
          value={totalIncome}
          icon={<ArrowUpCircle size={20} />}
          tone="positive"
          delay={120}
        />
        <StatCard
          label="Gastos del período"
          value={totalExpenses}
          icon={<ArrowDownCircle size={20} />}
          tone="negative"
          delay={180}
        />
      </div>

      <div className="card card-hover animate-fade-up overflow-hidden" style={{ animationDelay: '220ms' }}>
        {rows.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon size={22} />}
            title="Aún no hay movimientos registrados"
            hint="Los sobrantes por mes aparecen cuando registres salarios o gastos"
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
            {rows.map((r) => {
              const ratio = r.income > 0 ? r.surplus / r.income : 0
              return (
                <div key={r.month} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">
                      {monthLabel(r.month)}
                    </p>
                    <p
                      className={cn(
                        'text-sm font-bold',
                        r.surplus >= 0 ? 'text-pine-600' : 'text-coral-600',
                      )}
                    >
                      {r.surplus >= 0 ? '+' : '−'}
                      {formatCurrency(Math.abs(r.surplus))}
                    </p>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-xs text-ink/40">Ingresos</p>
                      <p className="text-sm font-medium text-ink/70">
                        {formatCurrency(r.income)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-ink/40">Gastos</p>
                      <p className="text-sm font-medium text-ink/70">
                        {formatCurrency(r.expenses)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-ink/40">Ahorro</p>
                      <p className="text-sm font-medium text-ink/70">
                        {r.income > 0 ? `${Math.round(ratio * 100)}%` : '—'}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-ink/50">
                    Acumulado:{' '}
                    <span className="font-medium text-ink/70">
                      {formatCurrency(r.accumulated)}
                    </span>
                  </p>
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
                  <th className="px-5 py-3 text-right font-medium">Sobrante</th>
                  <th className="px-5 py-3 text-right font-medium">Ahorro</th>
                  <th className="px-5 py-3 text-right font-medium">Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const ratio = r.income > 0 ? r.surplus / r.income : 0
                  return (
                    <tr key={r.month}>
                      <td className="px-5 py-3 font-medium text-ink">
                        {monthLabel(r.month)}
                      </td>
                      <td className="px-5 py-3 text-right text-ink/70">
                        {formatCurrency(r.income)}
                      </td>
                      <td className="px-5 py-3 text-right text-ink/70">
                        {formatCurrency(r.expenses)}
                      </td>
                      <td
                        className={cn(
                          'px-5 py-3 text-right font-semibold',
                          r.surplus >= 0 ? 'text-pine-600' : 'text-coral-600',
                        )}
                      >
                        {r.surplus >= 0 ? '+' : '−'}
                        {formatCurrency(Math.abs(r.surplus))}
                      </td>
                      <td className="px-5 py-3 text-right text-ink/60">
                        {r.income > 0 ? `${Math.round(ratio * 100)}%` : '—'}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-ink/70">
                        {formatCurrency(r.accumulated)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-100 bg-cream/60 font-medium text-ink">
                  <td className="px-5 py-3">Totales</td>
                  <td className="px-5 py-3 text-right">{formatCurrency(totalIncome)}</td>
                  <td className="px-5 py-3 text-right">{formatCurrency(totalExpenses)}</td>
                  <td
                    className={cn(
                      'px-5 py-3 text-right',
                      finalAccumulated >= 0 ? 'text-pine-600' : 'text-coral-600',
                    )}
                  >
                    {finalAccumulated >= 0 ? '+' : '−'}
                    {formatCurrency(Math.abs(finalAccumulated))}
                  </td>
                  <td className="px-5 py-3 text-right" />
                  <td className="px-5 py-3 text-right">{formatCurrency(finalAccumulated)}</td>
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
