import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  Repeat,
  PiggyBank,
  Wallet,
  Coins,
  Info,
  BarChart3,
} from 'lucide-react'
import { useForecast } from '@/hooks/useForecast'
import { useCountUp } from '@/hooks/useCountUp'
import { usePageTitle } from '@/hooks/usePageTitle'
import QueryError from '@/components/ui/QueryError'
import PageSkeleton from '@/components/ui/PageSkeleton'
import { cn } from '@/shared/lib/utils'
import { shortMonthLabel } from '@/shared/lib/dates'
import { formatCurrency } from '@/shared/lib/money'
import { savingsInMonths } from '@/lib/forecast'

const HORIZONS = [1, 3, 6]

// Máxima altura de barra en px (escala del gráfico de barras CSS)
const BAR_MAX = 120

function RangeRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-sm text-ink/60">{label}</span>
      <span className="text-sm font-medium text-ink">{formatCurrency(value)}</span>
    </div>
  )
}

export default function Forecast() {
  usePageTitle('Proyección')
  const { data, error, isLoading, refetch } = useForecast()
  const [months, setMonths] = useState(3)
  const animatedTotal = useCountUp(data?.totalExpense?.median ?? 0)
  const animatedSavings = useCountUp(
    data?.surplus && months > 0
      ? savingsInMonths(data.baseBalance, data.surplus, months).median
      : 0,
  )
  const animatedAvg = useCountUp(data?.avg?.expenses ?? 0)

  if (error) {
    return (
      <div className="space-y-6">
        <Header />
        <QueryError error={error} onRetry={() => void refetch()} />
      </div>
    )
  }

  if (isLoading || !data) return <PageSkeleton />

  const {
    nextMonth,
    baseBalance,
    fixedExpenses,
    fixedItems,
    variable,
    totalExpense,
    income,
    extraIncomeAvg,
    surplus,
    avg,
    historyMonths,
    hasEnoughHistory,
  } = data

  const savings =
    surplus && months > 0 ? savingsInMonths(baseBalance, surplus, months) : null

  type ChartBar = { month: string; expenses: number; projected?: boolean }
  const chartData: ChartBar[] = [
    ...historyMonths.map((m) => ({ month: m.month, expenses: m.expenses })),
    { month: nextMonth, expenses: totalExpense?.median ?? 0, projected: true },
  ]
  const maxChart = Math.max(...chartData.map((c) => c.expenses), 1)

  return (
    <div className="space-y-6">
      <Header />

      {!hasEnoughHistory && (
        <div className="animate-fade-up flex items-start gap-2.5 rounded-2xl border border-gold-200 bg-gold-100/60 p-4 text-sm text-gold-600">
          <Info size={16} className="mt-0.5 shrink-0" />
          <p>
            La proyección de gastos variables se afina con al menos 2 meses de
            historial completo. Por ahora se muestran los gastos fijos y tu
            promedio histórico.
          </p>
        </div>
      )}

      {/* Hero: gasto estimado del próximo mes */}
      <section className="animate-fade-up relative overflow-hidden rounded-2xl bg-gradient-to-br from-pine-700 via-pine-800 to-pine-950 p-5 text-white shadow-lg shadow-pine-900/20 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-400/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-14 left-1/3 h-40 w-40 rounded-full bg-pine-400/20 blur-2xl" />
        <div className="relative">
          <p className="text-sm font-medium text-pine-200">
            Gasto estimado · {shortMonthLabel(nextMonth)}
          </p>
          <p className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-5xl">
            {formatCurrency(animatedTotal)}
          </p>
          {totalExpense && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-pine-200">
              <span>
                Fijos <strong className="text-white">{formatCurrency(fixedExpenses)}</strong>
              </span>
              {variable && (
                <span>
                  Variables ~{' '}
                  <strong className="text-white">{formatCurrency(variable.median)}</strong>{' '}
                  <span className="text-pine-300">
                    ({formatCurrency(variable.low)}–{formatCurrency(variable.high)})
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Selector de horizonte + ahorro proyectado */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card card-hover animate-fade-up p-5 lg:col-span-2" style={{ animationDelay: '120ms' }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-sm font-semibold text-ink">Ahorro proyectado</h2>
            <div
              role="group"
              aria-label="Horizonte de proyección"
              className="flex rounded-xl bg-cream p-1"
            >
              {HORIZONS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setMonths(h)}
                  aria-pressed={months === h}
                  className={cn(
                    'min-h-9 rounded-lg px-3 text-sm font-medium transition-colors',
                    months === h
                      ? 'bg-pine-700 text-white shadow-sm'
                      : 'text-ink/55 hover:text-ink',
                  )}
                >
                  {h} {h === 1 ? 'mes' : 'meses'}
                </button>
              ))}
            </div>
          </div>

          {savings ? (
            <>
              <div className="flex items-end gap-2">
                <p className="font-display text-3xl font-bold tracking-tight text-pine-600">
                  {formatCurrency(animatedSavings)}
                </p>
                <p className="pb-1 text-sm text-ink/50">
                  al cierre del mes ({formatCurrency(baseBalance)}) + sobrante × {months}
                </p>
              </div>
              <div className="mt-3 space-y-1 rounded-xl bg-cream p-3">
                <RangeRow label="Realista" value={savings.median} />
                <RangeRow label="Optimista" value={savings.high} />
                <RangeRow label="Pesimista" value={savings.low} />
              </div>
            </>
          ) : (
            <p className="text-sm text-ink/50">
              Registra al menos 2 meses de gastos para proyectar tu ahorro.
            </p>
          )}
        </div>

        <div className="card card-hover animate-fade-up p-5" style={{ animationDelay: '200ms' }}>
          <div className="mb-4 flex items-center gap-2">
            <Wallet size={18} className="text-gold-600" />
            <h2 className="font-display text-sm font-semibold text-ink">Tu promedio mensual</h2>
          </div>
          {avg ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-ink/50">Gasto normal</p>
                <p className="font-display text-xl font-bold text-ink">{formatCurrency(animatedAvg)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                <div>
                  <p className="text-xs text-ink/50">Ingreso</p>
                  <p className="text-sm font-semibold text-pine-600">{formatCurrency(avg.income)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink/50">Sobrante</p>
                  <p className={cn('text-sm font-semibold', avg.surplus >= 0 ? 'text-pine-600' : 'text-coral-600')}>
                    {formatCurrency(avg.surplus)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink/50">Aún no hay meses completados.</p>
          )}
        </div>
      </section>

      {/* Gráfico: 6 meses + mes proyectado */}
      <section className="card card-hover animate-fade-up p-5" style={{ animationDelay: '280ms' }}>
        <div className="mb-5 flex items-center gap-2">
          <BarChart3 size={18} className="text-pine-600" />
          <h2 className="font-display text-sm font-semibold text-ink">Historial y proyección</h2>
        </div>
        <div className="flex items-end gap-2 sm:gap-3">
          {chartData.map((c) => {
            const h = Math.max(Math.round((c.expenses / maxChart) * BAR_MAX), 4)
            return (
              <div key={c.month} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <p className="text-[11px] font-semibold text-ink/70">{formatCurrency(c.expenses)}</p>
                <div
                  title={shortMonthLabel(c.month)}
                  className={cn(
                    'w-full max-w-16 rounded-t-lg transition-colors',
                    c.projected
                      ? 'bg-gold-400'
                      : 'bg-pine-200 hover:bg-pine-300',
                  )}
                  style={{ height: h }}
                />
                <p className="text-[11px] text-ink/45">{shortMonthLabel(c.month)}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Desglose fijos */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card card-hover animate-fade-up p-5" style={{ animationDelay: '360ms' }}>
          <div className="mb-4 flex items-center gap-2">
            <Repeat size={18} className="text-pine-600" />
            <h2 className="font-display text-sm font-semibold text-ink">
              Gastos fijos de {shortMonthLabel(nextMonth)}
            </h2>
          </div>
          {fixedItems.length === 0 ? (
            <p className="text-sm text-ink/50">Ningún servicio vence el próximo mes.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {fixedItems.map((item) => (
                <li key={item.description} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-ink">{item.description}</span>
                  <span className="text-sm font-semibold text-ink">{formatCurrency(item.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card card-hover animate-fade-up p-5" style={{ animationDelay: '420ms' }}>
          <div className="mb-4 flex items-center gap-2">
            <Coins size={18} className="text-pine-600" />
            <h2 className="font-display text-sm font-semibold text-ink">Ingresos esperados</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink/60">Nóminas del mes</span>
              <span className="text-sm font-semibold text-ink">{formatCurrency(income)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink/60">Otros ingresos (promedio)</span>
              <span className="text-sm font-semibold text-ink">{formatCurrency(extraIncomeAvg)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-sm font-semibold text-ink">Total esperado</span>
              <span className="text-sm font-bold text-pine-600">{formatCurrency(income + extraIncomeAvg)}</span>
            </div>
          </div>
          <div className="mt-5 rounded-xl bg-cream p-4">
            <div className="flex items-center gap-2 text-sm text-ink/60">
              <PiggyBank size={16} className="text-gold-600" />
              <p>
                A este ritmo podrías ahorrar{' '}
                <strong className="text-pine-600">
                  {surplus ? formatCurrency(surplus.median) : '—'}
                </strong>{' '}
                al mes.
              </p>
            </div>
            <Link
              to="/ahorros"
              className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800"
            >
              <PiggyBank size={16} />
              Ver mis metas de ahorro
            </Link>
          </div>
        </div>
      </section>

      {/* Nota metodológica */}
      <p className="animate-fade-up flex items-start gap-2 px-1 text-xs leading-relaxed text-ink/40">
        <Info size={14} className="mt-0.5 shrink-0" />
        Proyección estimada: gastos fijos exactos (servicios con fecha de pago en el mes)
        + mediana de tus gastos variables de los últimos meses. No es una promesa,
        es un punto de partida basado en tu historial.
      </p>
    </div>
  )
}

function Header() {
  return (
    <div className="animate-fade-up">
      <h1 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight text-ink">
        <TrendingUp size={22} className="text-pine-600" />
        Proyección
      </h1>
      <p className="mt-1 text-sm text-ink/50">
        Cuánto gastas al mes normalmente y cuánto podrías tener ahorrado.
      </p>
    </div>
  )
}
