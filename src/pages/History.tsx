import { ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react'
import { useMonthlySurpluses } from '@/hooks/useExpenses'
import StatCard from '@/components/ui/StatCard'
import PageSkeleton from '@/components/ui/PageSkeleton'
import { cn } from '@/lib/utils'
import { monthLabel } from '@/lib/dates'
import { formatCurrency } from '@/lib/money'

export default function History() {
  const { data: surpluses, isLoading } = useMonthlySurpluses()

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

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
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
          <p className="py-12 text-center text-sm text-ink/40">
            Aún no hay movimientos registrados
          </p>
        ) : (
          <div className="overflow-x-auto">
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
        )}
      </div>
    </div>
  )
}
