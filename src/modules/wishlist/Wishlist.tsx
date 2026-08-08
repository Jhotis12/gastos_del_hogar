import { useMemo, useState } from 'react'
import {
  ShoppingBag,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Wallet,
  CalendarClock,
} from 'lucide-react'
import {
  useWishlist,
  useSetWishlistStatus,
  useDeleteWishlistItem,
} from '@/modules/wishlist/hooks/useWishlist'
import { useRunningBalance } from '@/modules/expenses/hooks/useExpenses'
import { useForecast } from '@/modules/forecast/hooks/useForecast'
import { calculatePlan, monthsToAfford } from '@/modules/wishlist/lib/installments'
import WishlistItemForm from '@/modules/wishlist/components/WishlistItemForm'
import ConfirmDialog from '@/shared/components/ui/ConfirmDialog'
import EmptyState from '@/shared/components/ui/EmptyState'
import PageSkeleton from '@/shared/components/ui/PageSkeleton'
import QueryError from '@/shared/components/ui/QueryError'
import { useToast } from '@/shared/components/ui/Toast'

import { currentMonthKey, formatDate, shiftMonth, shortMonthLabel } from '@/shared/lib/dates'
import { formatCurrency } from '@/shared/lib/money'
import { cn, errorMessage } from '@/shared/lib/utils'
import { usePageTitle } from '@/shared/hooks/usePageTitle'
import Fab from '@/shared/components/ui/Fab'
import type { WishlistItem } from '@/shared/lib/types'

const PRIORITY_STYLE: Record<WishlistItem['priority'], string> = {
  necesidad: 'bg-pine-50 text-pine-600',
  deseo: 'bg-gold-100/70 text-gold-600',
  regalo: 'bg-slate-100 text-slate-500',
}

const PRIORITY_LABEL: Record<WishlistItem['priority'], string> = {
  necesidad: 'Necesidad',
  deseo: 'Deseo',
  regalo: 'Regalo',
}

export default function Wishlist() {
  usePageTitle('Quiero comprar')
  const { data: items, isLoading, error, refetch } = useWishlist()
  const { data: balance } = useRunningBalance(currentMonthKey())
  const { data: forecast } = useForecast()
  const setStatus = useSetWishlistStatus()
  const remove = useDeleteWishlistItem()
  const toast = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<WishlistItem | null>(null)
  const [deleting, setDeleting] = useState<WishlistItem | null>(null)

  const pending = useMemo(() => (items ?? []).filter((i) => i.status === 'pendiente'), [items])

  // Compromiso del mes: cuotas que vencen este mes en todas las compras pendientes
  const monthCommitment = useMemo(() => {
    const now = currentMonthKey()
    let total = 0
    let count = 0
    for (const item of pending) {
      if (item.payment_method !== 'cuotas') continue
      const plan = calculatePlan(
        Number(item.price),
        {
          installments: item.installments_count ?? 1,
          rateMonthly: item.interest_rate ?? 0,
          cutoffDay: item.cutoff_day,
          purchaseDate: item.purchase_date,
        },
        now,
      )
      if (plan.monthlyDue > 0) {
        total += plan.installment
        count++
      }
    }
    return { total, count }
  }, [pending])

  const surplus = forecast?.surplus?.median ?? null
  const commitmentPct = surplus && surplus > 0 ? Math.round((monthCommitment.total / surplus) * 100) : null

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await remove.mutateAsync(deleting.id)
      toast.success('Deseo eliminado')
      setDeleting(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-up flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-ink">
            <ShoppingBag size={24} className="text-pine-600" />
            Quiero comprar
          </h1>
          <p className="text-sm text-ink/50">
            Registra lo que quieres y mira cómo afecta tu bolsillo
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
          className="hidden min-h-12 items-center gap-2 rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800 lg:inline-flex"
        >
          <Plus size={16} />
          Nuevo deseo
        </button>
      </div>

      {/* Resumen */}
      <div className="animate-fade-up grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-pine-600" />
            <p className="text-sm font-medium text-ink/50">Saldo disponible</p>
          </div>
          <p className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">
            {formatCurrency(balance ?? 0)}
          </p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <CalendarClock size={16} className="text-gold-600" />
            <p className="text-sm font-medium text-ink/50">Cuotas que vencen este mes</p>
          </div>
          <p className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">
            {formatCurrency(monthCommitment.total)}
          </p>
          {commitmentPct !== null && (
            <p
              className={cn(
                'mt-1 text-xs font-medium',
                commitmentPct > 60 ? 'text-coral-600' : commitmentPct > 30 ? 'text-gold-600' : 'text-pine-600',
              )}
            >
              {commitmentPct}% de tu sobrante mensual
            </p>
          )}
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <ShoppingBag size={16} className="text-pine-600" />
            <p className="text-sm font-medium text-ink/50">Deseos pendientes</p>
          </div>
          <p className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">{pending.length}</p>
          <p className="mt-1 text-xs text-ink/40">
            {formatCurrency(pending.reduce((s, i) => s + Number(i.price), 0))} en total
          </p>
        </div>
      </div>

      {isLoading ? (
        <PageSkeleton />
      ) : error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : !items || items.length === 0 ? (
        <div className="card animate-fade-up border-2 border-dashed border-ink/10" style={{ animationDelay: '160ms' }}>
          <EmptyState
            icon={<ShoppingBag size={22} />}
            title="Sin deseos todavía"
            hint="Registra algo que quieras comprar y mira cuánto te quedaría, o cuánto pagarías en cuotas"
            action={
              <button
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
                className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800"
              >
                <Plus size={16} />
                Nuevo deseo
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {items.map((item, i) => {
            const plan = calculatePlan(
              Number(item.price),
              {
                installments: item.payment_method === 'cuotas' ? (item.installments_count ?? 1) : 1,
                rateMonthly: item.interest_rate ?? 0,
                cutoffDay: item.cutoff_day,
                purchaseDate: item.purchase_date,
                initialPayment: item.initial_payment ?? 0,
              },
              currentMonthKey(),
            )
            const isPending = item.status === 'pendiente'
            const itemInitial = item.initial_payment ?? 0
            const monthsCash = isPending
              ? monthsToAfford(Number(item.price), surplus ?? 0, itemInitial)
              : Infinity
            const monthsDate =
              monthsCash === Infinity ? null : shortMonthLabel(shiftMonth(currentMonthKey(), monthsCash))
            return (
              <div
                key={item.id}
                className={cn(
                  'card card-hover animate-fade-up p-5',
                  item.status === 'comprado' && 'opacity-60',
                )}
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-base font-semibold text-ink">{item.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', PRIORITY_STYLE[item.priority])}>
                        {PRIORITY_LABEL[item.priority]}
                      </span>
                      {item.payment_method === 'cuotas' && (
                        <span className="rounded-full bg-pine-50 px-2.5 py-0.5 text-xs font-medium text-pine-600">
                          {item.installments_count} cuotas
                          {item.interest_rate ? ` al ${item.interest_rate}%` : ' sin interés'}
                          {itemInitial > 0 ? ` · abono ${formatCurrency(itemInitial)}` : ''}
                        </span>
                      )}
                      {item.status === 'comprado' && (
                        <span className="rounded-full bg-pine-50 px-2.5 py-0.5 text-xs font-medium text-pine-600">
                          Comprado
                        </span>
                      )}
                      {item.status === 'descartado' && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-ink/50">
                          Descartado
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="shrink-0 font-display text-lg font-bold text-ink">
                    {formatCurrency(Number(item.price))}
                  </p>
                </div>

                {isPending && (
                  <div className="mt-4 space-y-1.5 rounded-xl bg-cream p-3 text-sm">
                    {itemInitial > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-ink/60">Abono + cuota</span>
                        <span className="font-semibold text-ink">
                          {formatCurrency(itemInitial + plan.installment)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-ink/60">
                        {item.payment_method === 'cuotas' ? 'Cuota mensual' : 'De contado'}
                      </span>
                      <span className="font-semibold text-ink">{formatCurrency(plan.installment)}</span>
                    </div>
                    {plan.firstPaymentDate && (
                      <div className="flex items-center justify-between">
                        <span className="text-ink/60">Primera cuota</span>
                        <span className="text-ink">{formatDate(plan.firstPaymentDate)}</span>
                      </div>
                    )}
                    {plan.totalInterest > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-ink/60">Interés total</span>
                        <span className="font-semibold text-coral-600">+{formatCurrency(plan.totalInterest)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-1.5">
                      <span className="text-ink/60">Te quedaría</span>
                      <span
                        className={cn(
                          'font-bold',
                          (balance ?? 0) - (itemInitial + plan.installment) >= 0
                            ? 'text-pine-600'
                            : 'text-coral-600',
                        )}
                      >
                        {formatCurrency((balance ?? 0) - (itemInitial + plan.installment))}
                      </span>
                    </div>
                    {monthsCash === 0 ? (
                      <p className="rounded-lg bg-pine-50 px-3 py-2 text-xs text-pine-600">
                        ✓ Con tu saldo ya podrías comprarlo de contado.
                      </p>
                    ) : monthsCash !== Infinity ? (
                      <p className="rounded-lg bg-pine-50 px-3 py-2 text-xs text-pine-600">
                        💰 Ahorrando tu sobrante, de contado en {monthsCash}{' '}
                        {monthsCash === 1 ? 'mes' : 'meses'} (~{monthsDate}).
                      </p>
                    ) : null}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {isPending && (
                    <>
                      <button
                        onClick={() => void setStatus.mutateAsync({ id: item.id, status: 'comprado' })}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-pine-50 px-3 py-2 text-xs font-medium text-pine-600 hover:bg-pine-100"
                      >
                        <CheckCircle2 size={14} />
                        Compré
                      </button>
                      <button
                        onClick={() => void setStatus.mutateAsync({ id: item.id, status: 'descartado' })}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-ink/55 hover:bg-cream"
                      >
                        <XCircle size={14} />
                        Descartar
                      </button>
                    </>
                  )}
                  {!isPending && item.status === 'pendiente' ? null : (
                    <button
                      onClick={() => void setStatus.mutateAsync({ id: item.id, status: 'pendiente' })}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-cream px-3 py-2 text-xs font-medium text-ink/55 hover:bg-surface"
                    >
                      Volver a pendiente
                    </button>
                  )}
                  <div className="ml-auto flex gap-1">
                    <button
                      onClick={() => {
                        setEditing(item)
                        setFormOpen(true)
                      }}
                      className="rounded-lg p-3 text-ink/40 hover:bg-cream hover:text-ink/70"
                      aria-label="Editar deseo"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setDeleting(item)}
                      className="rounded-lg p-3 text-ink/40 hover:bg-coral-100/70 hover:text-coral-600"
                      aria-label="Eliminar deseo"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Fab onClick={() => { setEditing(null); setFormOpen(true) }} label="Nuevo deseo" />

      <WishlistItemForm
        open={formOpen}
        initial={editing}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar deseo"
        message={`¿Eliminar "${deleting?.name}" de tu lista?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
        busy={remove.isPending}
      />
    </div>
  )
}
