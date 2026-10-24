import { useState } from 'react'
import { Plus, Trash2, Pencil, PiggyBank, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Target } from 'lucide-react'
import { useDeleteSavingsGoal, useSavingsGoals } from '@/modules/savings/hooks/useSavings'
import ConfirmDialog from '@/shared/components/ui/ConfirmDialog'
import EmptyState from '@/shared/components/ui/EmptyState'
import PageSkeleton from '@/shared/components/ui/PageSkeleton'
import QueryError from '@/shared/components/ui/QueryError'
import GoalForm from '@/modules/savings/components/GoalForm'
import AdjustGoalModal from '@/modules/savings/components/AdjustGoalModal'
import { useToast } from '@/shared/components/ui/Toast'
import type { SavingsGoal } from '@/shared/lib/types'
import { cn, errorMessage } from '@/shared/lib/utils'
import { formatCurrency } from '@/shared/lib/money'

import { usePageTitle } from '@/shared/hooks/usePageTitle'
import Fab from '@/shared/components/ui/Fab'
import { useForecast } from '@/modules/forecast/hooks/useForecast'
import { formatDate, shortMonthLabel, shiftMonth } from '@/shared/lib/dates'

export default function Savings() {
  usePageTitle('Metas de Ahorro')
  const { data: goals, isLoading, error, refetch } = useSavingsGoals()
  const { data: forecast } = useForecast()
  const remove = useDeleteSavingsGoal()
  const toast = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SavingsGoal | null>(null)
  const [adjusting, setAdjusting] = useState<{ goal: SavingsGoal; mode: 'deposit' | 'withdraw' } | null>(null)
  const [deleting, setDeleting] = useState<SavingsGoal | null>(null)

  const totalSaved = (goals ?? []).reduce((s, g) => s + Number(g.saved_amount), 0)
  const totalTarget = (goals ?? []).reduce((s, g) => s + Number(g.target_amount), 0)
  const completed = (goals ?? []).filter((g) => Number(g.saved_amount) >= Number(g.target_amount)).length

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await remove.mutateAsync(deleting.id)
      toast.success('Meta eliminada')
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
            <PiggyBank size={24} className="text-pine-600" />
            Metas de ahorro
          </h1>
          <p className="text-sm text-ink/50">
            Define objetivos y registra lo que ahorra el hogar
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
          Nueva meta
        </button>
      </div>

      <div className="animate-fade-up grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm font-medium text-ink/50">Total ahorrado</p>
          <p className="mt-2 font-display text-2xl font-bold tracking-tight text-pine-600">
            {formatCurrency(totalSaved)}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-ink/50">Meta total del hogar</p>
          <p className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">
            {formatCurrency(totalTarget)}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-ink/50">Metas alcanzadas</p>
          <p className="mt-2 font-display text-2xl font-bold tracking-tight text-gold-600">
            {completed}
          </p>
        </div>
      </div>

      {isLoading ? (
        <PageSkeleton />
      ) : error ? (
        <QueryError error={error} onRetry={refetch} />
      ) : !goals || goals.length === 0 ? (
        <div className="card animate-fade-up border-2 border-dashed border-ink/10" style={{ animationDelay: '160ms' }}>
          <EmptyState
            icon={<Target size={22} />}
            title="Sin metas todavía"
            hint="Define un objetivo y empieza a ahorrar"
            action={
              <button
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
                className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800"
              >
                <Plus size={16} />
                Nueva meta
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {goals.map((g, i) => {
            const target = Number(g.target_amount)
            const saved = Number(g.saved_amount)
            const ratio = Math.min(1, saved / target)
            const pct = Math.round((saved / target) * 100)
            const reached = saved >= target
            return (
              <div
                key={g.id}
                className="card card-hover animate-fade-up p-5"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-base font-semibold text-ink">
                      {g.name}
                    </p>
                    {g.target_date && (
                      <p className="mt-0.5 text-xs text-ink/40">
                        Para el {formatDate(g.target_date)}
                      </p>
                    )}
                  </div>
                  {reached ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-pine-50 px-2.5 py-1 text-xs font-medium text-pine-600">
                      <CheckCircle2 size={12} />
                      Alcanzada
                    </span>
                  ) : (
                    <span className="shrink-0 font-display text-lg font-bold text-pine-600">
                      {pct}%
                    </span>
                  )}
                </div>

                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-cream">
                  <div
                    className={cn(
                      'animate-grow-bar h-full rounded-full',
                      reached ? 'bg-pine-500' : 'bg-gradient-to-r from-pine-400 to-pine-600',
                    )}
                    style={{ width: `${Math.max(2, ratio * 100)}%` }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="font-semibold text-ink">
                    {formatCurrency(saved)}
                  </span>
                  <span className="text-ink/40">de {formatCurrency(target)}</span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {!reached && forecast?.surplus && forecast.surplus.median > 0 && (
                    <p className="flex w-full items-center gap-1.5 rounded-lg bg-pine-50/70 px-3 py-2 text-xs text-pine-600">
                      <PiggyBank size={13} className="shrink-0" />
                      A tu ritmo actual, completarías esta meta en{' '}
                      <strong>
                        {shortMonthLabel(
                          shiftMonth(forecast.nextMonth, Math.max(1, Math.ceil((target - saved) / forecast.surplus.median))),
                        )}
                      </strong>{' '}
                      ({Math.max(1, Math.ceil((target - saved) / forecast.surplus.median))}{' '}
                      {Math.max(1, Math.ceil((target - saved) / forecast.surplus.median)) === 1 ? 'mes' : 'meses'})
                    </p>
                  )}
                  <button
                    onClick={() => setAdjusting({ goal: g, mode: 'deposit' })}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-pine-50 px-3 py-2 text-xs font-medium text-pine-600 hover:bg-pine-100"
                  >
                    <ArrowDownToLine size={14} />
                    Depositar
                  </button>
                  <button
                    onClick={() => setAdjusting({ goal: g, mode: 'withdraw' })}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-gold-100/60 px-3 py-2 text-xs font-medium text-gold-600 hover:bg-gold-100"
                  >
                    <ArrowUpFromLine size={14} />
                    Retirar
                  </button>
                  <div className="ml-auto flex gap-1">
                    <button
                      onClick={() => {
                        setEditing(g)
                        setFormOpen(true)
                      }}
                      className="rounded-lg p-3 text-ink/40 hover:bg-cream hover:text-ink/70"
                      aria-label="Editar meta"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setDeleting(g)}
                      className="rounded-lg p-3 text-ink/40 hover:bg-coral-100/70 hover:text-coral-600"
                      aria-label="Eliminar meta"
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

      <Fab onClick={() => { setEditing(null); setFormOpen(true) }} label="Nueva meta de ahorro" />

      <GoalForm
        open={formOpen}
        initial={editing}
        onClose={() => setFormOpen(false)}
      />

      <AdjustGoalModal
        open={!!adjusting}
        goal={adjusting?.goal ?? null}
        mode={adjusting?.mode ?? 'deposit'}
        onClose={() => setAdjusting(null)}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar meta"
        message={`¿Eliminar la meta "${deleting?.name}"? El historial de la meta se perderá.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
        busy={remove.isPending}
      />
    </div>
  )
}
