import { useState } from 'react'
import { Plus, Trash2, Tags, Wallet } from 'lucide-react'
import { useAddCategory, useBudgets, useCategories, useDeleteCategory } from '@/hooks/useCategories'
import Modal from '@/components/ui/Modal'
import BudgetModal from '@/components/categories/BudgetModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Loading from '@/components/ui/Loading'
import QueryError from '@/components/ui/QueryError'
import { useToast } from '@/components/ui/Toast'
import type { Category } from '@/lib/types'
import { cn, errorMessage } from '@/lib/utils'
import { CATEGORY_COLORS, CATEGORY_ICONS, type CategoryIconKey } from '@/lib/constants'
import { currentMonthKey } from '@/lib/dates'
import { formatCurrency } from '@/lib/money'

export default function Categories() {
  const { data: categories, isLoading, error } = useCategories()
  const add = useAddCategory()
  const remove = useDeleteCategory()
  const toast = useToast()
  const month = currentMonthKey()
  const { data: budgets } = useBudgets(month)

  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(CATEGORY_COLORS[0])
  const [icon, setIcon] = useState<CategoryIconKey>('tag')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [budgetCategory, setBudgetCategory] = useState<Category | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    try {
      await add.mutateAsync({ name: name.trim(), color, icon })
      toast.success('Categoría creada')
      setFormOpen(false)
      setName('')
      setColor(CATEGORY_COLORS[0])
      setIcon('tag')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await remove.mutateAsync(deleting)
      toast.success('Categoría eliminada')
      setDeleting(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const openBudget = (c: Category) => {
    setBudgetCategory(c)
  }



  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-ink">
            <Tags size={24} className="text-pine-600" />
            Categorías
          </h1>
          <p className="text-sm text-ink/50">
            Clasifica tus gastos para ver dónde se va el dinero
          </p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800"
        >
          <Plus size={16} />
          Nueva categoría
        </button>
      </div>

      {isLoading ? (
        <Loading />
      ) : error ? (
        <QueryError error={error} />
      ) : !categories || categories.length === 0 ? (
        <div className="card border-2 border-dashed border-ink/10 py-16 text-center">
          <p className="text-sm text-ink/40">No hay categorías todavía</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => {
            const Icon = CATEGORY_ICONS[c.icon as CategoryIconKey] ?? CATEGORY_ICONS.tag
            const budget = budgets?.find((b) => b.category_id === c.id)
            return (
              <div
                key={c.id}
                className="flex items-center justify-between card px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${c.color}1a`, color: c.color }}
                  >
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                    <button
                      onClick={() => openBudget(c)}
                      className="mt-0.5 flex items-center gap-1 text-xs text-ink/40 hover:text-pine-600"
                      aria-label="Editar presupuesto"
                    >
                      <Wallet size={12} />
                      {budget
                        ? `Presupuesto: ${formatCurrency(Number(budget.amount))}`
                        : 'Sin presupuesto mensual'}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setDeleting(c.id)}
                  className="rounded-lg p-2 text-ink/40 hover:bg-coral-100/70 hover:text-coral-600"
                  aria-label="Eliminar categoría"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={formOpen} title="Nueva categoría" onClose={() => setFormOpen(false)}>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">
              Nombre
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-pine-500 focus:outline-none"
              placeholder="Ej. Educación"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">Icono</label>
            <div className="grid grid-cols-7 gap-2">
              {(Object.keys(CATEGORY_ICONS) as CategoryIconKey[]).map((key) => {
                const Icon = CATEGORY_ICONS[key]
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setIcon(key)}
                    className={cn(
                      'flex h-10 items-center justify-center rounded-lg border',
                      icon === key
                        ? 'border-pine-700 bg-pine-50 text-pine-600'
                        : 'border-slate-200 text-ink/50 hover:bg-cream',
                    )}
                  >
                    <Icon size={18} />
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">Color</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-8 w-8 rounded-full ring-2 ring-offset-2',
                    color === c ? 'ring-indigo-600' : 'ring-transparent',
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-cream"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={add.isPending}
              className="rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800 disabled:opacity-50"
            >
              {add.isPending ? 'Guardando…' : 'Crear'}
            </button>
          </div>
        </form>
      </Modal>

      <BudgetModal
        category={budgetCategory}
        month={month}
        onClose={() => setBudgetCategory(null)}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar categoría"
        message="Los gastos de esta categoría quedarán sin categoría, no se eliminan."
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
        busy={remove.isPending}
      />
    </div>
  )
}
