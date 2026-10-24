import { useState } from 'react'
import Modal from '@/shared/components/ui/Modal'
import ConfirmDialog from '@/shared/components/ui/ConfirmDialog'
import MoneyInput from '@/shared/components/ui/MoneyInput'
import { useDeleteBudget, useUpsertBudget } from '@/modules/categories/hooks/useCategories'
import { useToast } from '@/shared/components/ui/Toast'
import type { Category } from '@/shared/lib/types'
import { parseMoneyInput } from '@/shared/lib/money'
import { errorMessage } from '@/shared/lib/utils'

interface BudgetModalProps {
  category: Category | null
  month: string
  onClose: () => void
}

export default function BudgetModal({ category, month, onClose }: BudgetModalProps) {
  const upsertBudget = useUpsertBudget(month)
  const deleteBudget = useDeleteBudget(month)
  const toast = useToast()
  const [budgetAmount, setBudgetAmount] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)

  const saveBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!category) return
    const value = parseMoneyInput(budgetAmount)
    if (value === null) {
      toast.error('Ingresa un monto válido (ej. 450.000)')
      return
    }
    try {
      await upsertBudget.mutateAsync({ categoryId: category.id, amount: value })
      toast.success('Presupuesto guardado')
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const removeBudget = async () => {
    if (!category) return
    try {
      await deleteBudget.mutateAsync(category.id)
      toast.success('Presupuesto eliminado')
      setConfirmRemove(false)
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <>
      <Modal
        open={!!category}
        title={`Presupuesto mensual · ${category?.name ?? ''}`}
        onClose={onClose}
      >
        <form onSubmit={saveBudget} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">
              Límite del mes
            </label>
            <MoneyInput
              label="Límite del mes"
              value={budgetAmount}
              onChange={setBudgetAmount}
              autoFocus
              placeholder="Ej. 450.000"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            {category && (
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                disabled={deleteBudget.isPending}
                className="rounded-lg border border-coral-200 px-4 py-2 text-sm font-medium text-coral-600 hover:bg-coral-100/70 disabled:opacity-50"
              >
                Quitar presupuesto
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-cream"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={upsertBudget.isPending}
              className="rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800 disabled:opacity-50"
            >
              {upsertBudget.isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmRemove}
        title="Quitar presupuesto"
        message={`Se quitará el presupuesto de "${category?.name ?? ''}" para este mes. Los gastos se mantienen.`}
        confirmLabel="Quitar"
        busy={deleteBudget.isPending}
        onConfirm={() => void removeBudget()}
        onCancel={() => setConfirmRemove(false)}
      />
    </>
  )
}
