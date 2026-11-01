import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Info,
  PiggyBank,
  Repeat,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { useForecast } from '@/modules/forecast/hooks/useForecast'
import { useCountUp } from '@/shared/hooks/useCountUp'
import { usePageTitle } from '@/shared/hooks/usePageTitle'
import QueryError from '@/shared/components/ui/QueryError'
import PageSkeleton from '@/shared/components/ui/PageSkeleton'
import { cn } from '@/shared/lib/utils'
import { formatDate } from '@/shared/lib/dates'
import { formatCurrency } from '@/shared/lib/money'
import type { CycleVerdict } from '@/modules/forecast/lib/forecast'

type VerdictMeta = {
  label: string
  hint: string
  icon: typeof CheckCircle2
  badge: string
}

const VERDICT_META: Record<CycleVerdict, VerdictMeta> = {
  alcanza: {
    label: 'Te alcanza',
    hint: 'Tu disponible cubre los compromisos y tu gasto habitual.',
    icon: CheckCircle2,
    badge: 'bg-pine-500/20 text-pine-50 ring-pine-300/40',
  },
  no_alcanza: {
    label: 'No te alcanza',
    hint: 'Tus compromisos superan el disponible antes del próximo pago.',
    icon: XCircle,
    badge: 'bg-coral-500/20 text-coral-50 ring-coral-300/40',
  },
  ajustado: {
    label: 'Ajustado',
    hint: 'El resultado depende de cuánto gastes en variables.',
    icon: AlertTriangle,
    badge: 'bg-gold-400/20 text-gold-100 ring-gold-300/40',
  },
  preliminar: {
    label: 'Estimación preliminar',
    hint: 'La estimación mejorará cuando tengas más meses de historial.',
    icon: Info,
    badge: 'bg-white/10 text-pine-50 ring-white/20',
  },
  sin_base: {
    label: 'Sin base de ingresos',
    hint: 'Registra un ingreso para calcular tu disponible.',
    icon: Info,
    badge: 'bg-white/10 text-pine-50 ring-white/20',
  },
}

function formatSigned(value: number | null, sign?: string): string {
  if (value === null) return '—'
  const amount = formatCurrency(Math.abs(value))
  if (value === 0) return amount
  if (sign) return `${sign}${amount}`
  return value < 0 ? `−${amount}` : amount
}

function Header() {
  return (
    <div className="animate-fade-up">
      <h1 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight text-ink">
        <TrendingUp size={22} className="text-pine-600" />
        ¿Me alcanza?
      </h1>
      <p className="mt-1 text-sm text-ink/50">
        Tu disponible, tus compromisos y tu gasto variable antes del pago.
      </p>
    </div>
  )
}

function BreakdownRow({
  label,
  value,
  sign,
  strong,
  muted,
  note,
}: {
  label: string
  value: number | null
  sign?: string
  strong?: boolean
  muted?: boolean
  note?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <dt
        className={cn(
          'text-sm',
          strong ? 'font-semibold text-ink' : 'text-ink/60',
          muted && 'text-ink/40',
        )}
      >
        {label}
        {note && (
          <span className="mt-0.5 block text-xs text-ink/40">{note}</span>
        )}
      </dt>
      <dd
        className={cn(
          'whitespace-nowrap text-sm tabular-nums',
          strong ? 'font-bold text-ink' : 'font-medium text-ink',
          muted && 'text-ink/40',
        )}
      >
        {formatSigned(value, sign)}
      </dd>
    </div>
  )
}

function CommitmentRow({
  title,
  subtitle,
  amount,
  overdue,
  muted,
}: {
  title: string
  subtitle: string
  amount: number
  overdue?: boolean
  muted?: boolean
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p
          className={cn(
            'truncate text-sm',
            muted ? 'text-ink/45' : 'text-ink',
          )}
        >
          {title}
        </p>
        <p className="mt-0.5 text-xs text-ink/45">
          {subtitle}
          {overdue && (
            <>
              {' '}
              <span className="font-medium text-coral-600">· Vencido</span>
            </>
          )}
        </p>
      </div>
      <span
        className={cn(
          'whitespace-nowrap text-sm font-semibold tabular-nums',
          muted ? 'text-ink/40' : 'text-ink',
        )}
      >
        {formatCurrency(amount)}
      </span>
    </li>
  )
}

export default function Forecast() {
  usePageTitle('¿Me alcanza?')
  const { data, error, isLoading, refetch } = useForecast()
  const expected = data?.projection.expected ?? null
  const expectedValue = expected?.median ?? 0
  const daily = Math.max(0, data?.projection.dailyBudget ?? 0)
  const animatedExpected = useCountUp(Math.abs(expectedValue))
  const animatedDaily = useCountUp(daily)

  if (error) {
    return (
      <div className="space-y-6">
        <Header />
        <QueryError error={error} onRetry={() => void refetch()} />
      </div>
    )
  }

  if (isLoading || !data) return <PageSkeleton />

  const { projection } = data
  const meta = VERDICT_META[projection.verdict]
  const VerdictIcon = meta.icon
  const expectedLabel =
    projection.verdict === 'preliminar'
      ? 'Saldo antes de tus gastos variables'
      : expectedValue >= 0
        ? 'Te quedarían al próximo pago'
        : 'Te faltarían al próximo pago'
  const hasRange = expected !== null && expected.low !== expected.high
  const hasCommitments =
    data.fixedCommitments.length > 0 ||
    data.savingsPending.length > 0 ||
    data.savingsAlreadyRun.length > 0

  return (
    <div className="space-y-6">
      <Header />

      <section className="animate-fade-up relative overflow-hidden rounded-2xl bg-gradient-to-br from-pine-700 via-pine-800 to-pine-950 p-5 text-white shadow-lg shadow-pine-900/20 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-400/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-14 left-1/3 h-40 w-40 rounded-full bg-pine-400/20 blur-2xl" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-pine-200">
                Hasta tu próximo pago · {formatDate(data.nextPayday)}
              </p>
              <div
                role="status"
                aria-live="polite"
                className={cn(
                  'mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ring-1',
                  meta.badge,
                )}
              >
                <VerdictIcon size={16} aria-hidden="true" />
                {meta.label}
              </div>
            </div>

            {projection.verdict !== 'sin_base' && (
              <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-right backdrop-blur-sm">
                <p className="text-[11px] font-medium text-pine-200">
                  {daily > 0 ? 'Puedes gastar' : 'Margen diario'}
                </p>
                <p className="font-display text-xl font-semibold">
                  {daily > 0 ? formatCurrency(animatedDaily) : 'Sin margen'}
                  {daily > 0 && (
                    <span className="text-xs font-normal text-pine-200">
                      /día
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-pine-300">
                  {data.remainingDays}{' '}
                  {data.remainingDays === 1 ? 'día' : 'días'}
                </p>
              </div>
            )}
          </div>

          <div className="mt-5">
            {projection.verdict === 'sin_base' || !expected ? (
              <>
                <p className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
                  No hay un disponible todavía
                </p>
                <p className="mt-2 max-w-xl text-sm text-pine-200">
                  No se inventa un saldo. Registra un ingreso para saber si tu
                  dinero alcanza hasta el próximo pago.
                </p>
                <Link
                  to="/miembros"
                  className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-pine-800 hover:bg-pine-50"
                >
                  Registrar ingreso
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm text-pine-200">{expectedLabel}</p>
                <p
                  className={cn(
                    'mt-1 font-display text-3xl font-bold tracking-tight sm:text-5xl',
                    expectedValue < 0
                      ? 'text-coral-100'
                      : projection.verdict === 'ajustado'
                        ? 'text-gold-100'
                        : 'text-white',
                  )}
                >
                  {expectedValue < 0 ? '−' : ''}
                  {formatCurrency(animatedExpected)}
                </p>
                {hasRange && (
                  <p className="mt-2 text-sm text-pine-200">
                    Rango estimado: {formatSigned(expected.low)} –{' '}
                    {formatSigned(expected.high)}
                  </p>
                )}
                <p className="mt-1 max-w-xl text-sm text-pine-200">
                  {meta.hint}
                </p>
                {projection.variableDaily !== null && (
                  <p className="mt-2 text-xs text-pine-300">
                    Tu gasto variable habitual es ~
                    {formatCurrency(projection.variableDaily)}/día.
                  </p>
                )}
              </>
            )}
          </div>

          {data.nextSalary !== null && (
            <p className="mt-5 flex items-start gap-1.5 text-xs text-pine-300">
              <CalendarDays size={14} className="mt-0.5 shrink-0" />
              <span>
                Tu nómina del {formatDate(data.nextPayday)} reinicia el ciclo:{' '}
                {formatCurrency(data.nextSalary)}.
              </span>
            </p>
          )}
        </div>
      </section>

      <section
        className="card card-hover animate-fade-up p-5"
        style={{ animationDelay: '120ms' }}
      >
        <div className="mb-4 flex items-center gap-2">
          <Info size={18} className="text-pine-600" />
          <h2 className="font-display text-sm font-semibold text-ink">
            Así se calcula
          </h2>
        </div>
        <dl className="divide-y divide-slate-100">
          <BreakdownRow
            label="Disponible hoy"
            value={data.available}
            note={data.available === null ? 'Sin base de ingresos' : undefined}
          />
          <BreakdownRow
            label="Ingresos antes del pago"
            value={data.incomeBefore}
            sign="+"
          />
          <BreakdownRow
            label="Servicios antes del pago"
            value={data.fixedTotal}
            sign="−"
          />
          <BreakdownRow
            label="Ahorro programado"
            value={data.savingsPendingTotal}
            sign="−"
          />
          <BreakdownRow
            label="Para gastar antes del pago"
            value={projection.spendable}
            strong
          />
          <BreakdownRow
            label="Gasto variable estimado"
            value={projection.variableScaled?.median ?? null}
            sign="−"
            muted={!projection.variableScaled}
            note={
              projection.variableScaled
                ? `Mediana de ${data.variableMonths} ${
                    data.variableMonths === 1 ? 'mes' : 'meses'
                  } completos`
                : 'Sin historial suficiente'
            }
          />
          <BreakdownRow
            label="Saldo esperado al pago"
            value={expected?.median ?? null}
            strong
          />
        </dl>
        {hasRange && expected && (
          <p className="mt-3 text-xs text-ink/45">
            Rango p25–p75: {formatSigned(expected.low)} –{' '}
            {formatSigned(expected.high)}.
          </p>
        )}
      </section>

      <section
        className="card card-hover animate-fade-up p-5"
        style={{ animationDelay: '200ms' }}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Repeat size={18} className="text-pine-600" />
            <h2 className="font-display text-sm font-semibold text-ink">
              Compromisos antes del pago
            </h2>
          </div>
          <Link
            to="/recurrentes"
            className="inline-flex min-h-11 items-center text-sm font-medium text-pine-600 hover:text-ink"
          >
            Ver servicios
          </Link>
        </div>

        {!hasCommitments ? (
          <p className="text-sm text-ink/50">
            Sin compromisos antes de tu próximo pago.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.fixedCommitments.map((item) => (
              <CommitmentRow
                key={item.id}
                title={item.description}
                subtitle={formatDate(item.dueDate)}
                amount={item.amount}
                overdue={item.overdue}
              />
            ))}
            {data.savingsPending.map((item) => (
              <CommitmentRow
                key={item.id}
                title={`Autoahorro · ${item.goalName}`}
                subtitle={`Vence ${formatDate(item.dueDate)}`}
                amount={item.amount}
                overdue={item.overdue}
              />
            ))}
            {data.savingsAlreadyRun.map((item) => (
              <CommitmentRow
                key={item.id}
                title={`Autoahorro ya ejecutado · ${item.goalName}`}
                subtitle={`Se ejecutó el ${formatDate(item.dueDate)}`}
                amount={item.amount}
                muted
              />
            ))}
          </ul>
        )}

        {data.unassignedRecurringCount > 0 && (
          <p className="mt-4 rounded-xl bg-gold-100/60 p-3 text-xs leading-relaxed text-gold-700">
            {data.unassignedRecurringCount}{' '}
            {data.unassignedRecurringCount === 1
              ? 'servicio activo no tiene'
              : 'servicios activos no tienen'}{' '}
            responsable y no se incluyen.{' '}
            <Link to="/recurrentes" className="font-semibold underline">
              Asígnalos en Servicios
            </Link>
            .
          </p>
        )}
      </section>

      {data.savedAway > 0 && (
        <section
          className="card card-hover animate-fade-up p-5"
          style={{ animationDelay: '280ms' }}
        >
          <div className="mb-3 flex items-center gap-2">
            <PiggyBank size={18} className="text-gold-600" />
            <h2 className="font-display text-sm font-semibold text-ink">
              Ahorro ya apartado
            </h2>
          </div>
          <p className="font-display text-2xl font-bold tracking-tight text-pine-600">
            {formatCurrency(data.savedAway)}
          </p>
          <p className="mt-1 text-sm text-ink/50">
            Ya está descontado de tu disponible personal.
          </p>
          <Link
            to="/ahorros"
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800"
          >
            <PiggyBank size={16} />
            Ver mis metas de ahorro
          </Link>
        </section>
      )}

      <p className="animate-fade-up flex items-start gap-2 px-1 text-xs leading-relaxed text-ink/40">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          {projection.verdict === 'sin_base'
            ? 'No se usa el saldo del hogar ni se inventa un disponible. Registra un ingreso para ver el cálculo completo.'
            : `${
                data.variableMonths >= 2
                  ? `La estimación variable usa la mediana de tus últimos ${
                      data.variableMonths
                    } meses completos y el rango p25–p75, escalada a los ${
                      data.remainingDays
                    } ${data.remainingDays === 1 ? 'día' : 'días'} que faltan.`
                  : 'Aún no hay 2 meses completos de gastos variables; la estimación es preliminar y no incluye variables.'
              } No incluye ingresos extra no registrados ni gastos de otros miembros.${
                data.savedAway > 0
                  ? ' El ahorro ya apartado está descontado de tu disponible.'
                  : ''
              }`}
        </span>
      </p>
    </div>
  )
}
