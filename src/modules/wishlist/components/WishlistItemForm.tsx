import { useEffect, useMemo, useState } from 'react'
import Modal from '@/shared/components/ui/Modal'
import MoneyInput from '@/shared/components/ui/MoneyInput'
import SelectInput from '@/shared/components/ui/SelectInput'
import DateInput from '@/shared/components/ui/DateInput'
import { useToast } from '@/shared/components/ui/Toast'
import { useAddWishlistItem, useUpdateWishlistItem } from '@/modules/wishlist/hooks/useWishlist'
import { useRunningBalance } from '@/modules/expenses/hooks/useExpenses'
import { useForecast } from '@/modules/forecast/hooks/useForecast'
import { calculatePlan, monthsToAfford } from '@/modules/wishlist/lib/installments'
import { shiftMonth, shortMonthLabel } from '@/shared/lib/dates'
import { currentMonthKey, formatDate } from '@/shared/lib/dates'
import { formatCurrency, parseMoneyInput } from '@/shared/lib/money'
import { cn, errorMessage } from '@/shared/lib/utils'
import type { WishlistItem } from '@/shared/lib/types'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-surface px-4 py-3 text-base text-ink placeholder:text-ink/35 focus:border-pine-500 focus:outline-none focus:ring-2 focus:ring-pine-500/20'

const PRIORITIES: { value: WishlistItem['priority']; label: string }[] = [
  { value: 'necesidad', label: 'Necesidad' },
  { value: 'deseo', label: 'Deseo' },
  { value: 'regalo', label: 'Regalo' },
]

const PAYMENT_METHODS: { value: WishlistItem['payment_method']; label: string }[] = [
  { value: 'contado', label: 'De contado' },
  { value: 'cuotas', label: 'En cuotas' },
]

const INSTALLMENT_OPTIONS = [3, 6, 12, 18, 24, 36]
const RATE_OPTIONS = [0, 1, 1.5, 2, 2.5, 3]
const CUTOFF_DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

type Props = {
  open: boolean
  initial?: WishlistItem | null
  onClose: () => void
}

export default function WishlistItemForm({ open, initial, onClose }: Props) {
  const add = useAddWishlistItem()
  const update = useUpdateWishlistItem()
  const toast = useToast()
  const { data: balance } = useRunningBalance(currentMonthKey())
  const { data: forecast } = useForecast()

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [priority, setPriority] = useState<WishlistItem['priority']>('deseo')
  const [method, setMethod] = useState<WishlistItem['payment_method']>('contado')
  const [abono, setAbono] = useState('')
  const [installments, setInstallments] = useState(12)
  const [rate, setRate] = useState(0)
  const [cutoff, setCutoff] = useState<number | null>(15)
  const [purchaseDate, setPurchaseDate] = useState('')
  const [error, setError] = useState('')
  const isCuotas = method === 'cuotas'

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setPrice(initial ? String(initial.price) : '')
    setPriority(initial?.priority ?? 'deseo')
    setMethod(initial?.payment_method ?? 'contado')
    setAbono(initial?.initial_payment ? String(initial.initial_payment) : '')
    setInstallments(initial?.installments_count ?? 12)
    setRate(initial?.interest_rate ?? 0)
    setCutoff(initial?.cutoff_day ?? 15)
    setPurchaseDate(initial?.purchase_date ?? '')
    setError('')
  }, [open, initial])

  const priceValue = useMemo(() => parseMoneyInput(price) ?? 0, [price])
  const initialValue = useMemo(() => parseMoneyInput(abono) ?? 0, [abono])
  const financed = Math.max(0, priceValue - initialValue)

  const plan = useMemo(
    () =>
      calculatePlan(
        priceValue,
        {
          installments: method === 'cuotas' ? installments : 1,
          rateMonthly: method === 'cuotas' ? rate : 0,
          cutoffDay: method === 'cuotas' ? cutoff : null,
          purchaseDate: method === 'cuotas' ? purchaseDate || null : null,
          initialPayment: method === 'cuotas' ? initialValue : 0,
        },
        currentMonthKey(),
      ),
    [priceValue, method, installments, rate, cutoff, purchaseDate, initialValue],
  )

  const surplus = forecast?.surplus?.median ?? null
  const remaining =
    (balance ?? 0) - (isCuotas ? initialValue + plan.installment : plan.totalPaid)
  const monthsCash = monthsToAfford(priceValue, surplus ?? 0, isCuotas ? initialValue : 0)
  const monthsDate = monthsCash === Infinity ? null : shortMonthLabel(shiftMonth(currentMonthKey(), monthsCash))
  const surplusPct =
    surplus && surplus > 0 ? Math.round((plan.installment / surplus) * 100) : null
  const colchon = forecast?.avg?.expenses ?? null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Dale un nombre (ej. Nevera, Viaje a la costa, Zapatos)')
      return
    }
    if (priceValue <= 0) {
      setError('Ingresa el precio (ej. 2.500.000)')
      return
    }
    const input = {
      name: name.trim(),
      price: priceValue,
      priority,
      payment_method: method,
      initial_payment: initialValue || 0,
      installments_count: method === 'cuotas' ? installments : null,
      interest_rate: method === 'cuotas' ? rate : null,
      cutoff_day: method === 'cuotas' ? cutoff : null,
      purchase_date: method === 'cuotas' ? purchaseDate || null : null,
    }
    try {
      if (initial) {
        await update.mutateAsync({ ...input, id: initial.id })
        toast.success('Deseo actualizado')
      } else {
        await add.mutateAsync(input)
        toast.success('Deseo registrado')
      }
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Modal open={open} title={initial ? 'Editar deseo' : 'Quiero comprar'} onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink/70">¿Qué quieres comprar?</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Nevera, Viaje a la costa, Zapatos"
            className={inputClass}
            autoComplete="off"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink/70">Precio</label>
          <MoneyInput value={price} onChange={setPrice} placeholder="2.500.000" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink/70">Prioridad</label>
            <SelectInput value={priority} onChange={(e) => setPriority(e.target.value as WishlistItem['priority'])}>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </SelectInput>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink/70">Forma de pago</label>
            <SelectInput value={method} onChange={(e) => setMethod(e.target.value as WishlistItem['payment_method'])}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </SelectInput>
          </div>
        </div>

        {isCuotas && (
          <div className="space-y-4 rounded-xl bg-cream p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink/70">Abono inicial (contado)</label>
                <MoneyInput value={abono} onChange={setAbono} placeholder="500.000" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink/70">Nº de cuotas</label>
                <SelectInput value={installments} onChange={(e) => setInstallments(Number(e.target.value))}>
                  {INSTALLMENT_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} cuotas
                    </option>
                  ))}
                </SelectInput>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink/70">Interés mensual</label>
                <SelectInput value={rate} onChange={(e) => setRate(Number(e.target.value))}>
                  {RATE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r === 0 ? 'Sin interés' : `${r}%`}
                    </option>
                  ))}
                </SelectInput>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink/70">Corte de tarjeta</label>
                <SelectInput value={cutoff ?? 15} onChange={(e) => setCutoff(Number(e.target.value))}>
                  {CUTOFF_DAYS.map((d) => (
                    <option key={d} value={d}>
                      Día {d}
                    </option>
                  ))}
                </SelectInput>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink/70">Fecha en que comprarías</label>
              <DateInput type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>

            {/* Análisis en vivo del plan */}
            <div className="space-y-2 rounded-xl border border-slate-200 bg-surface p-4 text-sm">
              {initialValue > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-ink/60">Abono inicial</span>
                    <span className="font-semibold text-ink">-{formatCurrency(initialValue)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink/60">Se financia</span>
                    <span className="font-semibold text-ink">{formatCurrency(financed)}</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="text-ink/60">Cuota mensual</span>
                <span className="font-bold text-ink">{formatCurrency(plan.installment)}</span>
              </div>
              {plan.firstPaymentDate && (
                <div className="flex items-center justify-between">
                  <span className="text-ink/60">Primera cuota</span>
                  <span className="font-semibold text-ink">{formatDate(plan.firstPaymentDate)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-ink/60">Total pagado</span>
                <span className="font-semibold text-ink">{formatCurrency(plan.totalPaid)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink/60">Interés total</span>
                <span className={cn('font-semibold', plan.totalInterest > 0 ? 'text-coral-600' : 'text-pine-600')}>
                  {plan.totalInterest > 0 ? `+${formatCurrency(plan.totalInterest)}` : 'Ninguno'}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                <span className="text-ink/60">Te quedaría</span>
                <span className={cn('font-bold', remaining >= 0 ? 'text-pine-600' : 'text-coral-600')}>
                  {formatCurrency(remaining)}
                </span>
              </div>
              {surplusPct !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-ink/60">De tu sobrante mensual</span>
                  <span className={cn('font-semibold', surplusPct > 60 ? 'text-coral-600' : surplusPct > 30 ? 'text-gold-600' : 'text-pine-600')}>
                    {surplusPct}%
                  </span>
                </div>
              )}
              {colchon !== null && remaining < colchon && !isCuotas && (
                <p className="flex items-start gap-1.5 rounded-lg bg-coral-100/50 px-3 py-2 text-xs text-coral-600">
                  ⚠️ Tras esta compra te quedaría menos de tu gasto mensual promedio
                  ({formatCurrency(colchon)}). Sería quedarte sin colchón.
                </p>
              )}
              {monthsCash !== Infinity && monthsCash > 0 && surplus && (
                <p className="flex items-start gap-1.5 rounded-lg bg-pine-50 px-3 py-2 text-xs text-pine-600">
                  💰 Ahorrando tu sobrante mensual ({formatCurrency(surplus)}), podrías
                  comprarlo de contado en {monthsCash} {monthsCash === 1 ? 'mes' : 'meses'}{' '}
                  (aprox. {monthsDate}).
                </p>
              )}
              {monthsCash === 0 && (
                <p className="flex items-start gap-1.5 rounded-lg bg-pine-50 px-3 py-2 text-xs text-pine-600">
                  ✓ Con tu saldo y abono actual ya cubres esta compra de contado.
                </p>
              )}
              {plan.totalInterest > 0 && (
                <p className="flex items-start gap-1.5 rounded-lg bg-gold-100/60 px-3 py-2 text-xs text-gold-600">
                  💡 Si esperas y ahorras tu sobrante, podrías comprarlo de contado y
                  ahorrarte {formatCurrency(plan.totalInterest)} de intereses.
                </p>
              )}
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-coral-100/60 px-4 py-3 text-sm text-coral-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={add.isPending || update.isPending}
          className="min-h-12 w-full rounded-xl bg-gradient-to-br from-pine-600 to-pine-800 py-3 text-base font-semibold text-white shadow-lg shadow-pine-900/25 transition-all hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {add.isPending || update.isPending ? 'Guardando…' : initial ? 'Guardar cambios' : 'Registrar deseo'}
        </button>
      </form>
    </Modal>
  )
}
