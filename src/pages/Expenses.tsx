import { useState } from 'react'
import { Plus, Pencil, Trash2, Search, Download, ScanLine, ReceiptText } from 'lucide-react'
import { useAddExpense, useDeleteExpense, useExpenses, useUpdateExpense } from '@/hooks/useExpenses'
import ExpenseForm from '@/components/expenses/ExpenseForm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import CategoryBadge from '@/components/ui/CategoryBadge'
import UserAvatar from '@/components/ui/UserAvatar'
import MonthPicker from '@/components/ui/MonthPicker'
import PageSkeleton from '@/components/ui/PageSkeleton'
import QueryError from '@/components/ui/QueryError'
import ReceiptCapture from '@/components/expenses/ReceiptCapture'
import ReceiptResult from '@/components/expenses/ReceiptResult'
import ReceiptViewer from '@/components/expenses/ReceiptViewer'
import { useToast } from '@/components/ui/Toast'
import type { ExpenseWithRelations, Receipt } from '@/lib/types'
import { errorMessage } from '@/lib/utils'
import { formatDate, monthKey } from '@/lib/dates'
import { formatCurrency } from '@/lib/money'

import { usePageTitle } from '@/hooks/usePageTitle'
import { useMonthParam } from '@/hooks/useMonthParam'

export default function Expenses() {
  usePageTitle('Gastos')
  const [month, setMonth] = useMonthParam()
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

  const { data: expenses, isLoading, error, refetch } = useExpenses(month)
  const addExpense = useAddExpense()
  const updateExpense = useUpdateExpense()
  const deleteExpense = useDeleteExpense()

  const query = search.trim().toLowerCase()
  const filtered =
    (categoryFilter === 'all'
      ? expenses
      : expenses?.filter((e) => e.category_id === categoryFilter)) ??
    []
  const searched = query
    ? filtered.filter((e) => (e.description ?? '').toLowerCase().includes(query))
    : filtered

  const total = searched.reduce((sum, e) => sum + Number(e.amount), 0)

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
    a.download = `gastos-${month.slice(0, 7)}.csv`
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
        await updateExpense.mutateAsync({ id: editing.id, ...input })
        toast.success('Gasto actualizado')
      } else {
        await addExpense.mutateAsync(input)
        toast.success('Gasto registrado')
      }
    } catch (err) {
      toast.error(errorMessage(err))
      throw err
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await deleteExpense.mutateAsync(deleting.id)
      toast.success('Gasto eliminado')
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
            Total del mes filtrado: {formatCurrency(total)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthPicker month={month} onChange={setMonth} />
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

      <div className="animate-fade-up flex flex-wrap items-center gap-2" style={{ animationDelay: '90ms' }}>
        <div className="relative w-full sm:w-auto">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descripción…"
            className="w-full rounded-xl border border-slate-200 bg-surface py-2.5 pl-9 pr-3 text-base text-ink/70 focus:border-pine-500 focus:outline-none sm:w-56"
          />
        </div>
        <button
          onClick={() => setCategoryFilter('all')}
          className={`rounded-full px-3.5 py-2 text-xs font-medium ${
            categoryFilter === 'all'
              ? 'bg-ink text-cream'
              : 'bg-surface text-ink/55 ring-1 ring-ink/10 hover:bg-cream'
          }`}
        >
          Todas
        </button>
        {[...new Set(expenses?.map((e) => e.category?.id).filter(Boolean))].map(
          (id) => {
            const cat = expenses?.find((e) => e.category?.id === id)?.category
            if (!cat) return null
            return (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`rounded-full px-3.5 py-2 text-xs font-medium ${
                  categoryFilter === cat.id
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
            className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-surface px-3 py-2 text-xs font-medium text-ink/55 hover:bg-cream"
          >
            <Download size={16} />
            Exportar CSV
          </button>
        )}
      </div>

      {isLoading ? (
        <PageSkeleton />
      ) : error ? (
        <QueryError error={error} onRetry={refetch} />
      ) : !searched || searched.length === 0 ? (
        <div className="card animate-fade-up border-2 border-dashed border-ink/10" style={{ animationDelay: '160ms' }}>
          <EmptyState
            icon={<ReceiptText size={22} />}
            title={
              query || categoryFilter !== 'all'
                ? 'Sin resultados con los filtros actuales'
                : 'No hay gastos para este mes. Crea el primero.'
            }
            hint={
              query || categoryFilter !== 'all'
                ? 'Prueba con otros términos o quita los filtros'
                : 'Registra tu primer gasto para verlo aquí'
            }
            action={
              !query && categoryFilter === 'all' ? (
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
                    <p className="text-sm font-semibold text-ink">
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
          await addExpense.mutateAsync({ ...input, receipt_id: resultReceipt.id })
          setMonth(monthKey(new Date(`${input.expense_date}T00:00:00`)))
          setResultReceipt(null)
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

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar gasto"
        message={`¿Eliminar "${deleting?.description || 'Sin descripción'}" por ${deleting ? formatCurrency(Number(deleting.amount)) : ''}?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
        busy={deleteExpense.isPending}
      />

      {/* FAB + action-sheet (móvil): nuevo gasto o escanear factura */}
      <button
        onClick={() => setFabOpen(true)}
        aria-label="Agregar gasto"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-pine-700 text-white shadow-lg shadow-pine-900/30 transition-transform active:scale-95 lg:hidden"
      >
        <Plus size={26} />
      </button>

      {fabOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setFabOpen(false)} />
          <div className="animate-fade-up absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/10" />
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
