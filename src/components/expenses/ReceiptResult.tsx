import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Store } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import MoneyInput from '@/components/ui/MoneyInput'
import DateInput from '@/components/ui/DateInput'
import SelectInput from '@/components/ui/SelectInput'
import { useCategories } from '@/hooks/useCategories'
import { useMembers } from '@/hooks/useMembers'
import { useToast } from '@/components/ui/Toast'
import type { Receipt } from '@/lib/types'
import { errorMessage } from '@/lib/utils'
import { formatCurrency, parseMoneyInput } from '@/lib/money'
import { todayISO } from '@/lib/dates'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-surface px-4 py-3 text-base text-ink placeholder:text-ink/35 focus:border-pine-500 focus:outline-none focus:ring-2 focus:ring-pine-500/20'

interface ReceiptResultProps {
  receipt: Receipt | null
  busy: boolean
  onClose: () => void
  onCreate: (input: {
    amount: number
    description: string
    category_id: string | null
    paid_by: string | null
    expense_date: string
  }) => Promise<void>
}

export default function ReceiptResult({ receipt, busy, onClose, onCreate }: ReceiptResultProps) {
  const { data: categories } = useCategories()
  const { data: members } = useMembers()
  const toast = useToast()

  const [comercio, setComercio] = useState('')
  const [total, setTotal] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [paidBy, setPaidBy] = useState('')
  const [date, setDate] = useState(todayISO())
  const [error, setError] = useState('')

  useEffect(() => {
    if (!receipt) return
    const p = receipt.parsed_data
    setComercio(p.comercio ?? '')
    setTotal(p.total !== undefined ? String(p.total) : '')
    setCategoryId('')
    setPaidBy('')
    setDate(p.fecha && p.fecha.length === 10 ? p.fecha : todayISO())
    setError('')
  }, [receipt])

  const items = receipt?.parsed_data.items ?? []
  const itemsTotal = items.reduce((s, i) => s + Number(i.subtotal ?? 0), 0)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!receipt) return
    const amount = parseMoneyInput(total)
    if (amount === null) {
      setError('Ingresa un total válido (ej. 20.500)')
      return
    }
    if (!comercio.trim()) {
      setError('Escribe el nombre de la tienda')
      return
    }
    try {
      await onCreate({
        amount,
        description: comercio.trim(),
        category_id: categoryId || null,
        paid_by: paidBy || null,
        expense_date: date,
      })
      toast.success('Gasto creado desde la factura')
    } catch (err) {
      toast.error(errorMessage(err))
      throw err
    }
  }

  const visibleItems = useMemo(
    () => (items.length > 0 ? items : receipt?.parsed_data.total ? null : []),
    [items, receipt],
  )

  return (
    <Modal open={!!receipt} title="Factura analizada" onClose={onClose}>
      {receipt && (
        <form onSubmit={submit} className="space-y-4">
          {/* Réplica de la factura (estilo ticket) */}
          <div className="rounded-xl border border-dashed border-slate-300 bg-cream/70 p-5 text-center">
            <p className="flex items-center justify-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide text-ink">
              <Store size={14} className="text-pine-600" />
              {comercio || 'Tienda'}
            </p>
            <p className="mt-1 text-xs text-ink/40">{date}</p>
            <div className="mx-auto my-3 w-full border-t border-dashed border-slate-300" />
            {visibleItems === null ? null : items.length === 0 ? (
              <p className="py-2 text-sm text-ink/40">Sin items detectados</p>
            ) : (
              <div className="space-y-1.5 text-left text-sm">
                {items.map((it, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-ink/70">
                      {it.descripcion}
                      {Number(it.cantidad) > 1 && (
                        <span className="text-xs text-ink/40"> ×{it.cantidad}</span>
                      )}
                    </span>
                    <span className="shrink-0 font-medium text-ink/70">
                      {formatCurrency(Number(it.subtotal ?? it.valor_unitario))}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="mx-auto my-3 w-full border-t border-dashed border-slate-300" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink/50">
                TOTAL
              </span>
              <span className="font-display text-xl font-bold text-ink">
                {total ? formatCurrency(Number(total)) : formatCurrency(itemsTotal)}
              </span>
            </div>
            {items.length > 0 && Number(total) !== itemsTotal && (
              <p className="mt-1 text-xs text-ink/40">
                Suma de items: {formatCurrency(itemsTotal)}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">
              Nombre de la tienda
            </label>
            <input
              type="text"
              value={comercio}
              onChange={(e) => setComercio(e.target.value)}
              className={inputClass}
              placeholder="Ej. Supermercado Don José"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink/70">Total</label>
              <MoneyInput value={total} onChange={setTotal} placeholder="Ej. 20.500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink/70">Fecha</label>
              <DateInput
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink/70">Categoría</label>
              <SelectInput
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Sin categoría</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink/70">¿Quién pagó?</label>
              <SelectInput
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
              >
                <option value="">Sin asignar</option>
                {members?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                  </option>
                ))}
              </SelectInput>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-coral-100/60 px-3 py-2 text-sm text-coral-600">{error}</p>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            <p className="flex items-center gap-1.5 text-xs text-pine-600">
              <CheckCircle2 size={12} />
              Se creará 1 solo gasto con el total
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-cream"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800 disabled:opacity-50"
              >
                {busy ? 'Creando…' : 'Crear gasto'}
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  )
}
