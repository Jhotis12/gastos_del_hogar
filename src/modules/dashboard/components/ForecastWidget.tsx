import { Link } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import { useForecast } from '@/modules/forecast/hooks/useForecast'
import { savingsInMonths } from '@/modules/forecast/lib/forecast'
import { shortMonthLabel } from '@/shared/lib/dates'
import { formatCurrency } from '@/shared/lib/money'

// Widget compacto: proyección del próximo mes y ahorro a 3 meses.
export default function ForecastWidget() {
  const { data, error, isLoading } = useForecast()
  const next = data?.totalExpense?.median
  const savings = data?.surplus ? savingsInMonths(data.baseBalance, data.surplus, 3) : null

  if (isLoading || error || !data || next === undefined || !savings) return null

  return (
    <Link
      to="/proyeccion"
      className="card card-hover animate-fade-up block p-5"
      style={{ animationDelay: '360ms' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pine-50 text-pine-600">
            <TrendingUp size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Proyección del próximo mes</p>
            <p className="text-xs text-ink/50">
              {shortMonthLabel(data.nextMonth)}: ~{formatCurrency(next)}
              {data.variable ? ` (${formatCurrency(data.variable.low)}–${formatCurrency(data.variable.high)})` : ''}
            </p>
          </div>
        </div>
        <div className="rounded-xl bg-cream px-4 py-2 text-right">
          <p className="text-xs text-ink/50">Ahorro posible en 3 meses</p>
          <p className="font-display text-lg font-bold text-pine-600">
            ~{formatCurrency(savings.median)}
          </p>
        </div>
        <span className="text-sm font-medium text-pine-600">
          Ver análisis →
        </span>
      </div>
    </Link>
  )
}
