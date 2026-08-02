import { useState } from 'react'
import { Copy, Check, Users, User, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import {
  useDeleteSalary,
  useMembers,
  useSalaries,
  useSalaryRows,
  useUpdatePayday,
  useUpsertSalary,
} from '@/hooks/useMembers'
import { useExpenses } from '@/hooks/useExpenses'
import { useHousehold } from '@/hooks/useHousehold'
import MonthPicker from '@/components/ui/MonthPicker'
import SelectInput from '@/components/ui/SelectInput'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Loading from '@/components/ui/Loading'
import QueryError from '@/components/ui/QueryError'
import MoneyInput from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/utils'
import { payDateForMonth } from '@/lib/salaries'
import { currentMonthKey, monthLabel, todayISO } from '@/lib/dates'
import { formatCurrency, parseMoneyInput } from '@/lib/money'
import type { EffectiveSalary, Profile } from '@/lib/types'

const PAY_DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

function SalaryInput({
  profileId,
  month,
  canEdit,
  effective,
  payday,
}: {
  profileId: string
  month: string
  canEdit: boolean
  effective?: EffectiveSalary
  payday?: number | null
}) {
  const { data: rows } = useSalaryRows(month)
  const upsert = useUpsertSalary()
  const remove = useDeleteSalary()
  const toast = useToast()
  const row = rows?.find((s) => s.profile_id === profileId)
  const inherited = !!effective && effective.source_month !== month

  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState(row ? String(row.amount) : '')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const startEdit = () => {
    setAmount(
      row ? String(row.amount) : effective ? String(effective.amount) : '',
    )
    setEditing(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = parseMoneyInput(amount)
    if (value === null) return
    try {
      await upsert.mutateAsync({
        profileId,
        month,
        amount: value,
        payDate: payDateForMonth(payday, month),
      })
      toast.success('Salario guardado')
      setEditing(false)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const handleDelete = async () => {
    if (!row) return
    try {
      await remove.mutateAsync(row.id)
      toast.success('Salario eliminado')
      setConfirmOpen(false)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  if (!editing) {
    if (row) {
      return (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-pine-600">
            {formatCurrency(Number(row.amount))}
          </span>
          {canEdit && (
            <div className="flex gap-1">
              <button
                onClick={startEdit}
                className="rounded-lg p-2 text-ink/40 hover:bg-slate-100 hover:text-ink/55"
                aria-label="Editar salario"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => setConfirmOpen(true)}
                className="rounded-lg p-2 text-ink/40 hover:bg-coral-100/70 hover:text-coral-600"
                aria-label="Eliminar salario"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
          <ConfirmDialog
            open={confirmOpen}
            title="Eliminar salario"
            message={`¿Eliminar el salario de ${formatCurrency(Number(row.amount))} de este mes?`}
            onConfirm={handleDelete}
            onCancel={() => setConfirmOpen(false)}
            busy={remove.isPending}
          />
        </div>
      )
    }
    if (inherited && effective) {
      return (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-right">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="text-sm font-semibold text-pine-600">
                {formatCurrency(Number(effective.amount))}
              </span>
              <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-medium text-gold-700">
                Heredado de {monthLabel(effective.source_month ?? month)}
              </span>
            </div>
            {effective.pay_date > todayISO() && (
              <p className="mt-0.5 text-xs text-ink/40">
                Llega el {Number(effective.pay_date.slice(-2))} de{' '}
                {monthLabel(month)}
              </p>
            )}
          </div>
          {canEdit && (
            <button
              onClick={startEdit}
              className="rounded-lg p-2 text-ink/40 hover:bg-slate-100 hover:text-ink/55"
              aria-label="Editar salario heredado"
            >
              <Pencil size={16} />
            </button>
          )}
        </div>
      )
    }
    if (!canEdit) {
      return <span className="text-sm text-slate-300">Sin salario</span>
    }
    return (
      <button
        onClick={startEdit}
        className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm text-ink/40 hover:border-pine-400 hover:text-pine-600"
      >
        + Registrar salario
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <MoneyInput
        value={amount}
        onChange={setAmount}
        autoFocus
        className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-pine-500 focus:outline-none"
        placeholder="0.00"
      />
      <button
        type="submit"
        disabled={upsert.isPending}
        className="rounded-lg bg-pine-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-pine-800 disabled:opacity-50"
      >
        Guardar
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="rounded-lg px-2 py-1.5 text-sm text-ink/50 hover:bg-slate-100"
      >
        Cancelar
      </button>
    </form>
  )
}

export default function Members() {
  const { user } = useAuth()
  const [month, setMonth] = useState(currentMonthKey())
  const { data: household } = useHousehold()
  const { data: members, error: membersError } = useMembers()
  const { data: salaries } = useSalaries(month)
  const { data: expenses, error: expensesError } = useExpenses(month)
  const updatePayday = useUpdatePayday()
  const [copied, setCopied] = useState(false)

  if (!household) return <Loading />

  if (membersError || expensesError)
    return <QueryError error={membersError ?? expensesError} />

  const totalIncome =
    salaries?.reduce((sum, s) => sum + Number(s.amount), 0) ?? 0

  const balances = (members ?? []).map((m) => {
    const aportado =
      salaries?.filter((s) => s.profile_id === m.id).reduce((sum, s) => sum + Number(s.amount), 0) ??
      0
    const pagado =
      expenses?.filter((e) => e.paid_by === m.id).reduce((sum, e) => sum + Number(e.amount), 0) ??
      0
    return { member: m, aportado, pagado, balance: aportado - pagado }
  })

  const handlePaydayChange = (m: Profile) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    updatePayday.mutate({ profileId: m.id, payday: Number(e.target.value) })
  }

  const copyCode = async () => {
    await navigator.clipboard.writeText(household.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-ink">
            <Users size={24} className="text-pine-600" />
            Miembros y Salarios
          </h1>
          <p className="text-sm text-ink/50">
            Cada persona registra su salario; se suma al fondo común
          </p>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-pine-200 bg-pine-50 p-4">
        <div>
          <p className="text-sm font-medium text-pine-800">
            Ingreso unificado del mes
          </p>
          <p className="text-2xl font-bold text-pine-700">
            {formatCurrency(totalIncome)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
            Código de invitación
          </p>
          <button
            onClick={copyCode}
            className="mt-1 inline-flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 text-sm font-semibold text-ink/70 shadow-sm hover:bg-cream"
          >
            {copied ? <Check size={16} className="text-pine-600" /> : <Copy size={16} />}
            {household.invite_code}
          </button>
          <p className="mt-1 text-xs text-ink/40">
            Compártelo para que otros se unan
          </p>
        </div>
      </div>

      <div className="card">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">Saldos del mes</h2>
          <p className="mt-0.5 text-xs text-ink/40">
            Aportado (salario) − pagado (gastos que abonó) = saldo por persona
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {balances.map(({ member, aportado, pagado, balance }) => (
            <div
              key={member.id}
              className={`rounded-xl border p-4 ${
                balance >= 0
                  ? 'border-pine-200 bg-pine-50/50'
                  : 'border-coral-200 hover:bg-coral-100/70/50'
              }`}
            >
              <p className="text-sm font-medium text-ink">{member.full_name}</p>
              <div className="mt-2 space-y-1 text-xs text-ink/50">
                <p className="flex justify-between">
                  <span>Aportado</span>
                  <span className="font-medium text-ink/70">
                    {formatCurrency(aportado)}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span>Pagado</span>
                  <span className="font-medium text-ink/70">
                    -{formatCurrency(pagado)}
                  </span>
                </p>
              </div>
              <p
                className={`mt-3 text-lg font-bold ${
                  balance >= 0 ? 'text-pine-600' : 'text-coral-600'
                }`}
              >
                {balance >= 0 ? 'A favor' : 'Debe'} · {formatCurrency(Math.abs(balance))}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">
            Personas del hogar
          </h2>
        </div>
        <ul className="divide-y divide-slate-100">
          {members?.map((m) => {
            const effective = salaries?.find((s) => s.profile_id === m.id)
            return (
              <li key={m.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-ink/50">
                    {m.id === user?.id ? (
                      <User size={18} />
                    ) : (
                      <span className="text-sm font-semibold">
                        {m.full_name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {m.full_name}
                      {m.id === user?.id && (
                        <span className="ml-2 rounded-full bg-pine-50 px-2 py-0.5 text-xs font-medium text-pine-600">
                          Tú
                        </span>
                      )}
                    </p>
                    {m.id === user?.id ? (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-ink/40">Día de pago</span>
                        <SelectInput
                          aria-label="Día de pago"
                          value={m.payday ?? 1}
                          onChange={handlePaydayChange(m)}
                          className="w-24"
                        >
                          {PAY_DAYS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </SelectInput>
                      </div>
                    ) : (
                      <p className="text-xs text-ink/40">
                        Miembro del hogar · paga el día {m.payday ?? 1}
                      </p>
                    )}
                  </div>
                </div>
                <SalaryInput
                  profileId={m.id}
                  month={month}
                  canEdit={m.id === user?.id}
                  effective={effective}
                  payday={m.payday ?? 1}
                />
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
