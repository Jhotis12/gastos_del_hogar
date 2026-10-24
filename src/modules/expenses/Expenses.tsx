import { useState } from 'react'
import { Plus, Pencil, Trash2, Search, Download, ScanLine, ReceiptText, AlertTriangle } from 'lucide-react'
import { useAddExpense, useDeleteExpense, useExpenses, useUpdateExpense } from '@/modules/expenses/hooks/useExpenses'
import { useFinanceWindow } from '@/modules/finance/hooks/useFinanceWindow'
import { categoryBreakdown } from '@/modules/finance/lib/ledger'
import { useMembers } from '@/modules/members/hooks/useMembers'
import LegacyPayerModal from '@/modules/expenses/components/LegacyPayerModal'
import ExpenseForm from '@/modules/expenses/components/ExpenseForm'
import ConfirmDialog from '@/shared/components/ui/ConfirmDialog'
import EmptyState from '@/shared/components/ui/EmptyState'
import CategoryBadge from '@/shared/components/ui/CategoryBadge'
import UserAvatar from '@/shared/components/ui/UserAvatar'
import MonthPicker from '@/shared/components/ui/MonthPicker'
import PageSkeleton from '@/shared/components/ui/PageSkeleton'
import QueryError from '@/shared/components/ui/QueryError'
import { fieldBase } from '@/shared/components/ui/fieldClass'
import ReceiptCapture from '@/modules/expenses/components/ReceiptCapture'
import ReceiptResult from '@/modules/expenses/components/ReceiptResult'
import ReceiptViewer from '@/modules/expenses/components/ReceiptViewer'
import { useToast } from '@/shared/components/ui/Toast'
import { useDragToClose } from '@/shared/hooks/useDragToClose'
import { useDialogA11y } from '@/shared/hooks/useDialogA11y'
import { cn } from '@/shared/lib/utils'
import type { ExpenseWithRelations, Receipt } from '@/shared/lib/types'
import { errorMessage } from '@/shared/lib/utils'
import { formatDate, monthKey, monthLabel, todayISO } from '@/shared/lib/dates'
import { rangeLabel } from '@/shared/lib/periods'
import { formatCurrency } from '@/shared/lib/money'

import { usePageTitle } from '@/shared/hooks/usePageTitle'
import Fab from '@/shared/components/ui/Fab'
import { useMonthParam } from '@/shared/hooks/useMonthParam'
import { OFFLINE_QUEUED } from '@/shared/lib/offline/offlineSafe'

export default function Expenses() {
  usePageTitle('Gastos')
  const [month, setMonth] = useMonthParam()
  const [view, setView] = useState<'hogar' | 'personal'>('hogar')
  const [personalRange, setPersonalRange] = useState<'month' | 'cycle'>('month')
  const [legacyOpen, setLegacyOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ExpenseWithRelations | null>(null)
  const [deleting, setDeleting] = useState<ExpenseWithRelations | null>(null)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [resultReceipt, setResultReceipt] = useState<Receipt | null>(null)
  const [viewExpense, setViewExpense] = useState<ExpenseWithRelations | null>(null)
  const [fabOpen, setFabOpen] = useState(false)
  const toast = useToast()
  const fabDrag = useDragToClose(() => setFabOpen(false))
  const fabRequestClose = fabDrag.requestClose
  // El action sheet del FAB se comporta como diálogo (Escape, foco, Tab).
  useDialogA11y(fabOpen, fabRequestClose, fabDrag.panelRef)

  const householdQuery = useExpenses(month)
  const personalQuery = useFinanceWindow(todayISO())
  const personalWindow = personalQuery.window[personalRange]
  const allExpenses = view === 'hogar'
    ? householdQuery.data
    : (personalQuery.data?.expenses ?? []).filter(
        (expense) =>
          expense.expense_date >= personalWindow.start &&
          expense.expense_date <= personalWindow.end,
      )
  const isLoading = view === 'hogar' ? householdQuery.isLoading : personalQuery.isPending
  const error = view === 'hogar' ? householdQuery.error : personalQuery.error
  const refetch = view === 'hogar' ? householdQuery.refetch : personalQuery.refetch
  const addExpense = useAddExpense()
  const updateExpense = useUpdateExpense()
  const deleteExpense = useDeleteExpense()
  const { data: members } = useMembers()

  const query = search.trim().toLowerCase()
  const expenses = allExpenses ?? []
  const activeCategory =
    categoryFilter === 'all' ||
    expenses.some((expense) => expense.category_id === categoryFilter)
      ? categoryFilter
      : 'all'
  const filtered =
    activeCategory === 'all'
      ? expenses
      : expenses.filter((e) => e.category_id === activeCategory)
  const searched = query
    ? filtered.filter((e) => (e.description ?? '').toLowerCase().includes(query))
    : filtered

  const total = searched.reduce((sum, e) => sum + Number(e.amount), 0)
  const totalLabel =
    view === 'hogar'
      ? `Total del mes filtrado · ${monthLabel(month)}`
      : `Total filtrado · ${rangeLabel(personalWindow)}`
  const filtersActive = !!query || activeCategory !== 'all'
  const unassigned = view === 'hogar' ? expenses.filter((expense) => expense.paid_by === null) : []
  const unassignedTotal = unassigned.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0,
  )
  const categoryRows =
    view === 'personal'
      ? categoryBreakdown(searched).map((row) => {
          const category =
            searched.find((expense) => expense.category_id === row.categoryId)?.category ?? null
          return {
            ...row,
            name: category?.name ?? 'Sin categoría',
            color: category?.color ?? '#94a3b8',
          }
        })
      : []

  const assignLegacy = async (ids: string[], memberId: string) => {
    for (const id of ids) {
      const expense = expenses.find((row) => row.id === id)
      if (!expense) continue
      await updateExpense.mutateAsync({
        id,
        amount: Number(expense.amount),
        description: expense.description,
        category_id: expense.category_id,
        paid_by: memberId,
        expense_date: expense.expense_date,
      })
    }
  }

  const exportCSV = () => {
    const header = ['Fecha', 'Descripción', 'Categoría', 'Quién pagó', 'Monto']
    const rows = searched.map((e) => [
      e.expense_date,
      e.description,
      e.category?.name ?? '',
      e.payer?.full_name ?? '',
      String(Number(e.amount)),
    ])
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gastos-${
      view === 'hogar'
        ? month.slice(0, 7)
        : `personal-${personalWindow.start}-${personalWindow.end}`
    }.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exportados ${searched.length} gastos`)
  }

  const handleSave = async (input: {
    amount: number
    description: string
    category_id: string | null
    paid_by: string | null
    expense_date: string
  }) => {
    try {
      if (editing) {
        const res = await updateExpense.mutateAsync({ id: editing.id, ...input })
        if (res !== OFFLINE_QUEUED) toast.success('Gasto actualizado')
      } else {
        const res = await addExpense.mutateAsync(input)
        if (res !== OFFLINE_QUEUED) toast.success('Gasto registrado')
      }
    } catch (err) {
      toast.error(errorMessage(err))
      throw err
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      const res = await deleteExpense.mutateAsync(deleting.id)
      if (res !== OFFLINE_QUEUED) toast.success('Gasto eliminado')
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
            <ReceiptText size={24} className="text-pine-600" />
            Gastos
          </h1>
          <p className="text-sm text-ink/50">
            {totalLabel}: {formatCurrency(total)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {view === 'hogar' && <MonthPicker month={month} onChange={setMonth} />}
          <button
            onClick={() => setCaptureOpen(true)}
            className="hidden min-h-12 items-center gap-2 rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-pine-950 hover:bg-gold-600 lg:inline-flex"
          >
            <ScanLine size={16} />
            Escanear factura
          </button>
          <button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
            className="hidden min-h-12 items-center gap-2 rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800 lg:inline-flex"
          >
            <Plus size={16} />
            Nuevo gasto
          </button>
        </div>
      </div>

      <div className="animate-fade-up flex flex-wrap items-center gap-3" style={{ animationDelay: '60ms' }}>
        <div
          role="tablist"
          aria-label="Vista de gastos"
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
            Mis gastos
          </button>
        </div>

        {view === 'personal' && (
          <div
            role="group"
            aria-label="Ventana de mis gastos"
            className="inline-flex rounded-full bg-cream p-1 ring-1 ring-ink/5"
          >
            <button
              aria-pressed={personalRange === 'month'}
              onClick={() => setPersonalRange('month')}
              className={cn(
                'min-h-10 rounded-full px-3.5 py-2 text-xs font-medium transition-colors',
                personalRange === 'month'
                  ? 'bg-pine-700 text-white'
                  : 'text-ink/55 hover:text-ink',
              )}
            >
              Este mes
            </button>
            <button
              aria-pressed={personalRange === 'cycle'}
              onClick={() => setPersonalRange('cycle')}
              className={cn(
                'min-h-10 rounded-full px-3.5 py-2 text-xs font-medium transition-colors',
                personalRange === 'cycle'
                  ? 'bg-pine-700 text-white'
                  : 'text-ink/55 hover:text-ink',
              )}
            >
              Desde mi último pago
            </button>
          </div>
        )}
      </div>

      {view === 'hogar' && unassigned.length > 0 && (
        <div className="animate-fade-up flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold-200 bg-gold-100/60 p-4">
          <p className="flex items-center gap-2 text-sm text-gold-600">
            <AlertTriangle size={16} />
            {unassigned.length} gasto{unassigned.length !== 1 && 's'} sin pagador
            (histórico) · {formatCurrency(unassignedTotal)}
          </p>
          <button
            onClick={() => setLegacyOpen(true)}
            className="inline-flex min-h-11 items-center rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800"
          >
            Asignar pagador
          </button>
        </div>
      )}

      <div className="animate-fade-up flex flex-wrap items-center gap-2" style={{ animationDelay: '90ms' }}>
        <div className="relative w-full sm:w-auto">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descripción…"
            aria-label="Buscar por descripción"
            className={cn(fieldBase, 'py-2.5 pl-9 pr-3 sm:w-56')}
          />
        </div>
        <button
          onClick={() => setCategoryFilter('all')}
          className={`inline-flex min-h-11 items-center rounded-full px-3.5 py-2 text-xs font-medium ${
            activeCategory === 'all'
              ? 'bg-ink text-cream'
              : 'bg-surface text-ink/55 ring-1 ring-ink/10 hover:bg-cream'
          }`}
        >
          Todas
        </button>
        {[...new Set(expenses.map((e) => e.category?.id).filter(Boolean))].map(
          (id) => {
            const cat = expenses.find((e) => e.category?.id === id)?.category
            if (!cat) return null
            return (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`inline-flex min-h-11 items-center rounded-full px-3.5 py-2 text-xs font-medium ${
                  activeCategory === cat.id
                    ? 'bg-ink text-cream'
                    : 'bg-surface text-ink/55 ring-1 ring-ink/10 hover:bg-cream'
                }`}
              >
                {cat.name}
              </button>
            )
          },
        )}
        {searched.length > 0 && (
          <button
            onClick={exportCSV}
            className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-surface px-3 py-2 text-xs font-medium text-ink/55 hover:bg-cream"
          >
            <Download size={16} />
            Exportar CSV
          </button>
        )}
      </div>

      {view === 'personal' && categoryRows.length > 0 && (
        <section className="card animate-fade-up p-5" style={{ animationDelay: '140ms' }}>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-sm font-semibold text-ink">
              Mis gastos por categoría
            </h2>
            <p className="text-xs text-ink/50">
              La suma coincide con el total filtrado
            </p>
          </div>
          <ul className="space-y-2.5">
            {categoryRows.map((row) => (
              <li key={row.categoryId ?? 'sin-categoria'}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-ink/70">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="truncate">{row.name}</span>
                  </span>
                  <span className="shrink-0 font-medium text-ink">
                    {formatCurrency(row.total)}
                    <span className="ml-2 text-xs font-normal text-ink/40">
                      {Math.round(row.share * 100)}%
                    </span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-cream">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(3, row.share * 100)}%`,
                      backgroundColor: row.color,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isLoading ? (
        <PageSkeleton />
      ) : error ? (
        <QueryError error={error} onRetry={refetch} />
      ) : !searched || searched.length === 0 ? (
        <div className="card animate-fade-up border-2 border-dashed border-ink/10" style={{ animationDelay: '160ms' }}>
          <EmptyState
            icon={<ReceiptText size={22} />}
            title={
              filtersActive
                ? 'Sin resultados con los filtros actuales'
                : view === 'personal'
                  ? 'No hay gastos tuyos en esta ventana.'
                  : 'No hay gastos para este mes. Crea el primero.'
            }
            hint={
              filtersActive
                ? 'Prueba con otros términos o quita los filtros'
                : view === 'personal'
                  ? 'Registra un gasto tuyo para verlo aquí'
                  : 'Registra tu primer gasto para verlo aquí'
            }
            action={
              !filtersActive ? (
                <button
                  onClick={() => {
                    setEditing(null)
                    setFormOpen(true)
                  }}
                  className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800"
                >
                  <Plus size={16} />
                  Nuevo gasto
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="card animate-fade-up overflow-hidden" style={{ animationDelay: '180ms' }}>
          <ul className="divide-y divide-slate-100">
            {searched.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {e.description || 'Sin descripción'}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink/50">
                    {e.category && (
                      <CategoryBadge name={e.category.name} color={e.category.color} />
                    )}
                    {e.payer ? (
                      <span className="flex items-center gap-1.5">
                        <UserAvatar name={e.payer.full_name} avatarPath={e.payer.avatar_path} size="xs" />
                        {e.payer.full_name}
                      </span>
                    ) : (
                      <span>Sin asignar</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <div className="text-right">
                    <p className="whitespace-nowrap text-sm font-semibold text-ink">
                      -{formatCurrency(Number(e.amount))}
                    </p>
                    <p className="text-xs text-ink/40">
                      {formatDate(e.expense_date)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {e.receipt && (
                      <button
                        onClick={() => setViewExpense(e)}
                        className="rounded-lg p-3 text-gold-600 hover:bg-gold-100/60"
                        aria-label="Ver factura"
                        title="Ver factura"
                      >
                        <ReceiptText size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditing(e)
                        setFormOpen(true)
                      }}
                      className="rounded-lg p-3 text-ink/40 hover:bg-slate-100 hover:text-ink/55"
                      aria-label="Editar"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setDeleting(e)}
                      className="rounded-lg p-3 text-ink/40 hover:bg-coral-100/70 hover:text-coral-600"
                      aria-label="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ReceiptCapture
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onAnalyzed={(receipt) => setResultReceipt(receipt)}
      />

      <ReceiptResult
        receipt={resultReceipt}
        busy={addExpense.isPending}
        onClose={() => setResultReceipt(null)}
        onCreate={async (input) => {
          if (!resultReceipt) return
          const res = await addExpense.mutateAsync({ ...input, receipt_id: resultReceipt.id })
          setMonth(monthKey(new Date(`${input.expense_date}T00:00:00`)))
          setResultReceipt(null)
          // ReceiptResult decide si muestra su aviso (el offline ya avisó).
          return res
        }}
      />

      <ReceiptViewer
        expense={viewExpense}
        onClose={() => setViewExpense(null)}
      />

      <ExpenseForm
        open={formOpen}
        initial={editing}
        onClose={() => setFormOpen(false)}
        busy={addExpense.isPending || updateExpense.isPending}
        onSave={handleSave}
      />

      <LegacyPayerModal
        open={legacyOpen}
        expenses={unassigned}
        members={members ?? []}
        busy={updateExpense.isPending}
        onClose={() => setLegacyOpen(false)}
        onAssign={assignLegacy}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar gasto"
        message={`¿Eliminar "${deleting?.description || 'Sin descripción'}" por ${deleting ? formatCurrency(Number(deleting.amount)) : ''}?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
        busy={deleteExpense.isPending}
      />

      {/* FAB + action-sheet (móvil): nuevo gasto o escanear factura */}
      <Fab onClick={() => setFabOpen(true)} label="Agregar gasto" />

      {fabOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={fabRequestClose} />
          <div
            ref={fabDrag.panelRef}
            style={fabDrag.style}
            role="dialog"
            aria-modal="true"
            aria-label="Acciones de gasto"
            className={cn(
              'animate-sheet-up absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl',
              !fabDrag.dragging && !fabDrag.closing && 'transition-transform duration-300 ease-out',
            )}
          >
            <div
              {...fabDrag.handleProps}
              className="mb-1 flex shrink-0 touch-none justify-center py-2"
            >
              <span
                className={cn(
                  'h-1 w-10 rounded-full transition-colors duration-200',
                  fabDrag.touching ? 'bg-pine-500' : fabDrag.dragging ? 'bg-pine-600' : 'bg-ink/10',
                )}
              />
            </div>
            <button
              onClick={() => {
                setFabOpen(false)
                setEditing(null)
                setFormOpen(true)
              }}
              className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-ink/80 hover:bg-cream"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-pine-50 text-pine-600">
                <Plus size={18} />
              </span>
              Nuevo gasto
            </button>
            <button
              onClick={() => {
                setFabOpen(false)
                setCaptureOpen(true)
              }}
              className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-ink/80 hover:bg-cream"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-100 text-gold-600">
                <ScanLine size={18} />
              </span>
              Escanear factura
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
