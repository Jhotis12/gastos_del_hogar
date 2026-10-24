import { useMemo, useState } from 'react'
import {
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  History,
  Pencil,
  PiggyBank,
  Plus,
  Repeat,
  Target,
  Trash2,
  Users,
} from 'lucide-react'
import {
  useDeleteSavingsGoal,
  useSavingsGoals,
} from '@/modules/savings/hooks/useSavings'
import {
  useArchiveSavingsGoal,
  useSavingsMovements,
  useSavingsPlans,
} from '@/modules/savings/hooks/useSavingsMovements'
import GoalForm from '@/modules/savings/components/GoalForm'
import SavingsMovementModal from '@/modules/savings/components/SavingsMovementModal'
import SavingsHistoryModal from '@/modules/savings/components/SavingsHistoryModal'
import SavingsPlanModal from '@/modules/savings/components/SavingsPlanModal'
import ConfirmDialog from '@/shared/components/ui/ConfirmDialog'
import EmptyState from '@/shared/components/ui/EmptyState'
import PageSkeleton from '@/shared/components/ui/PageSkeleton'
import QueryError from '@/shared/components/ui/QueryError'
import { useToast } from '@/shared/components/ui/Toast'
import { useAuth } from '@/shared/hooks/useAuth'
import type { SavingsGoal } from '@/shared/lib/types'
import { cn, errorMessage } from '@/shared/lib/utils'
import { formatCurrency } from '@/shared/lib/money'
import { formatDate } from '@/shared/lib/dates'
import { usePageTitle } from '@/shared/hooks/usePageTitle'
import Fab from '@/shared/components/ui/Fab'

type MovementState = {
  goal: SavingsGoal
  mode: 'deposit' | 'withdrawal'
}

export default function Savings() {
  usePageTitle('Ahorros')
  const { profile } = useAuth()
  const { data: goals, isLoading, error, refetch } = useSavingsGoals()
  const { data: movements } = useSavingsMovements()
  const { data: plans } = useSavingsPlans()
  const archive = useArchiveSavingsGoal()
  const remove = useDeleteSavingsGoal()
  const toast = useToast()

  const [tab, setTab] = useState<'personal' | 'shared'>('personal')
  const [showArchived, setShowArchived] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SavingsGoal | null>(null)
  const [movement, setMovement] = useState<MovementState | null>(null)
  const [history, setHistory] = useState<SavingsGoal | null>(null)
  const [planGoal, setPlanGoal] = useState<SavingsGoal | null>(null)
  const [archiving, setArchiving] = useState<SavingsGoal | null>(null)
  const [deleting, setDeleting] = useState<SavingsGoal | null>(null)

  const personal = useMemo(
    () => (goals ?? []).filter((goal) => goal.owner_id === profile?.id),
    [goals, profile?.id],
  )
  const shared = useMemo(
    () => (goals ?? []).filter((goal) => goal.owner_id === null),
    [goals],
  )
  const base = tab === 'personal' ? personal : shared
  const visible = base.filter((goal) =>
    showArchived ? !!goal.archived_at : !goal.archived_at,
  )
  const archivedCount = base.filter((goal) => !!goal.archived_at).length

  const totalSaved = visible.reduce((sum, goal) => sum + Number(goal.saved_amount), 0)
  const totalTarget = visible.reduce((sum, goal) => sum + Number(goal.target_amount), 0)
  const completed = visible.filter(
    (goal) => Number(goal.saved_amount) >= Number(goal.target_amount),
  ).length

  const goalMovements = (goalId: string) =>
    (movements ?? []).filter((movement) => movement.goal_id === goalId)
  const ownNet = (goalId: string) =>
    goalMovements(goalId)
      .filter((movement) => movement.member_id === profile?.id)
      .reduce((sum, movement) => sum + Number(movement.amount), 0)
  const goalPlan = (goalId: string) =>
    (plans ?? []).find(
      (plan) => plan.goal_id === goalId && plan.member_id === profile?.id,
    )
  const hasMovements = (goalId: string) => goalMovements(goalId).length > 0

  const handleArchive = async () => {
    if (!archiving) return
    try {
      await archive.mutateAsync(archiving.id)
      toast.success('Meta archivada; el ahorro se conserva')
      setArchiving(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

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
            Ahorros
          </h1>
          <p className="text-sm text-ink/50">
            Metas personales o compartidas, con depósitos y retiros reales
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

      <div className="animate-fade-up flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label="Vista de ahorros"
          className="inline-flex rounded-full bg-cream p-1 ring-1 ring-ink/5"
        >
          <button
            role="tab"
            aria-selected={tab === 'personal'}
            onClick={() => setTab('personal')}
            className={cn(
              'min-h-10 rounded-full px-4 py-2 text-sm font-medium transition-colors',
              tab === 'personal' ? 'bg-ink text-cream' : 'text-ink/55 hover:text-ink',
            )}
          >
            Mis metas
          </button>
          <button
            role="tab"
            aria-selected={tab === 'shared'}
            onClick={() => setTab('shared')}
            className={cn(
              'min-h-10 rounded-full px-4 py-2 text-sm font-medium transition-colors',
              tab === 'shared' ? 'bg-ink text-cream' : 'text-ink/55 hover:text-ink',
            )}
          >
            Compartidas
          </button>
        </div>
        {archivedCount > 0 && (
          <button
            onClick={() => setShowArchived((value) => !value)}
            className={cn(
              'min-h-10 rounded-full px-3.5 py-2 text-xs font-medium ring-1 ring-ink/10',
              showArchived ? 'bg-gold-100 text-gold-600' : 'bg-surface text-ink/55 hover:bg-cream',
            )}
          >
            {showArchived ? 'Ver activas' : `Ver archivadas (${archivedCount})`}
          </button>
        )}
      </div>

      <div className="animate-fade-up grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm font-medium text-ink/50">Total ahorrado</p>
          <p className="mt-2 font-display text-2xl font-bold tracking-tight text-pine-600">
            {formatCurrency(totalSaved)}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-ink/50">Meta total</p>
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
      ) : visible.length === 0 ? (
        <div className="card animate-fade-up border-2 border-dashed border-ink/10">
          <EmptyState
            icon={<Target size={22} />}
            title={
              showArchived
                ? 'Sin metas archivadas'
                : tab === 'personal'
                  ? 'Todavía no tienes metas personales'
                  : 'El hogar no tiene metas compartidas'
            }
            hint={
              tab === 'personal'
                ? 'Crea una meta personal: solo tú la verás.'
                : 'Crea una meta compartida para ahorrar entre todos.'
            }
            action={
              !showArchived ? (
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
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visible.map((goal, index) => {
            const target = Number(goal.target_amount)
            const saved = Number(goal.saved_amount)
            const ratio = target > 0 ? Math.min(1, saved / target) : 0
            const pct = target > 0 ? Math.round((saved / target) * 100) : 0
            const reached = saved >= target
            const archived = !!goal.archived_at
            const own = ownNet(goal.id)
            const plan = goalPlan(goal.id)

            return (
              <div
                key={goal.id}
                className="card card-hover animate-fade-up p-5"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-display text-base font-semibold text-ink">
                        {goal.name}
                      </p>
                      <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-xs font-medium text-ink/55">
                        {goal.owner_id ? 'Personal' : <Users size={11} />}
                        {goal.owner_id ? '' : 'Compartida'}
                      </span>
                      {archived && (
                        <span className="rounded-full bg-gold-100 px-2 py-0.5 text-xs font-medium text-gold-600">
                          Archivada
                        </span>
                      )}
                    </div>
                    {goal.target_date && (
                      <p className="mt-0.5 text-xs text-ink/40">
                        Para el {formatDate(goal.target_date)}
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
                  <span className="font-semibold text-ink">{formatCurrency(saved)}</span>
                  <span className="text-ink/40">de {formatCurrency(target)}</span>
                </div>

                {!goal.owner_id && !archived && (
                  <p className="mt-1 text-xs text-ink/45">
                    Tu aporte neto: {formatCurrency(Math.max(0, own))} · puedes
                    retirar hasta {formatCurrency(Math.max(0, own))}
                  </p>
                )}

                {plan && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-pine-50/70 px-2.5 py-1.5 text-xs text-pine-600">
                    <Repeat size={12} />
                    Autoahorro {formatCurrency(Number(plan.amount))} el día{' '}
                    {plan.day_of_month}
                    {!plan.is_active && ' · pausado'}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {!archived && (
                    <>
                      <button
                        onClick={() => setMovement({ goal, mode: 'deposit' })}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-pine-50 px-3 py-2 text-xs font-medium text-pine-600 hover:bg-pine-100"
                      >
                        <ArrowDownToLine size={14} />
                        Depositar
                      </button>
                      <button
                        onClick={() => setMovement({ goal, mode: 'withdrawal' })}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-gold-100/60 px-3 py-2 text-xs font-medium text-gold-600 hover:bg-gold-100"
                      >
                        <ArrowUpFromLine size={14} />
                        Retirar
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setHistory(goal)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface px-3 py-2 text-xs font-medium text-ink/55 ring-1 ring-ink/10 hover:bg-cream"
                  >
                    <History size={14} />
                    Movimientos
                  </button>
                  {!archived && (
                    <button
                      onClick={() => setPlanGoal(goal)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface px-3 py-2 text-xs font-medium text-ink/55 ring-1 ring-ink/10 hover:bg-cream"
                    >
                      <Repeat size={14} />
                      Autoahorro
                    </button>
                  )}
                  <div className="ml-auto flex gap-1">
                    {!archived && (
                      <button
                        onClick={() => {
                          setEditing(goal)
                          setFormOpen(true)
                        }}
                        className="rounded-lg p-3 text-ink/40 hover:bg-cream hover:text-ink/70"
                        aria-label="Editar meta"
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {!archived && (
                      <button
                        onClick={() => setArchiving(goal)}
                        className="rounded-lg p-3 text-ink/40 hover:bg-gold-100/60 hover:text-gold-600"
                        aria-label="Archivar meta"
                      >
                        <Archive size={16} />
                      </button>
                    )}
                    {!hasMovements(goal.id) && saved === 0 && (
                      <button
                        onClick={() => setDeleting(goal)}
                        className="rounded-lg p-3 text-ink/40 hover:bg-coral-100/70 hover:text-coral-600"
                        aria-label="Eliminar meta"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Fab
        onClick={() => {
          setEditing(null)
          setFormOpen(true)
        }}
        label="Nueva meta de ahorro"
      />

      <GoalForm open={formOpen} initial={editing} onClose={() => setFormOpen(false)} />

      <SavingsMovementModal
        open={!!movement}
        goal={movement?.goal ?? null}
        mode={movement?.mode ?? 'deposit'}
        maxWithdrawal={
          movement && !movement.goal.owner_id ? Math.max(0, ownNet(movement.goal.id)) : null
        }
        onClose={() => setMovement(null)}
      />

      <SavingsHistoryModal
        open={!!history}
        goal={history}
        onClose={() => setHistory(null)}
      />

      <SavingsPlanModal
        open={!!planGoal}
        goal={planGoal}
        onClose={() => setPlanGoal(null)}
      />

      <ConfirmDialog
        open={!!archiving}
        title="Archivar meta"
        message={`¿Archivar "${archiving?.name}"? El historial se conserva y el dinero sigue descontado del disponible. Para devolverlo, retíralo antes de archivar.`}
        confirmLabel="Archivar"
        onConfirm={handleArchive}
        onCancel={() => setArchiving(null)}
        busy={archive.isPending}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar meta"
        message={`¿Eliminar "${deleting?.name}"? Solo se pueden eliminar metas sin movimientos.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
        busy={remove.isPending}
      />
    </div>
  )
}
