import { useState } from 'react'
import { Copy, Check, Users, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '@/shared/hooks/useAuth'
import { useDeleteSalary, useMembers, useSalaries, useSalaryRows, useUpdatePayday, useUpsertSalary } from '@/modules/members/hooks/useMembers'
import { useHousehold } from '@/modules/profile/hooks/useHousehold'
import IncomeSection from '@/modules/members/components/IncomeSection'
import UserAvatar from '@/shared/components/ui/UserAvatar'
import MonthPicker from '@/shared/components/ui/MonthPicker'
import SelectInput from '@/shared/components/ui/SelectInput'
import ConfirmDialog from '@/shared/components/ui/ConfirmDialog'
import DateInput from '@/shared/components/ui/DateInput'
import PageSkeleton from '@/shared/components/ui/PageSkeleton'
import QueryError from '@/shared/components/ui/QueryError'
import MoneyInput from '@/shared/components/ui/MoneyInput'
import { useToast } from '@/shared/components/ui/Toast'
import { errorMessage } from '@/shared/lib/utils'
import { payDateForMonth } from '@/modules/members/lib/salaries'
import { formatDate, monthLabel, todayISO } from '@/shared/lib/dates'
import { formatCurrency, parseMoneyInput } from '@/shared/lib/money'
import type { EffectiveSalary, Profile } from '@/shared/lib/types'

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
  const [payDate, setPayDate] = useState(
    row ? row.pay_date : payDateForMonth(payday, month),
  )
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [dateMismatchOpen, setDateMismatchOpen] = useState(false)

  const startEdit = () => {
    setAmount(
      row ? String(row.amount) : effective ? String(effective.amount) : '',
    )
    setPayDate(row ? row.pay_date : payDateForMonth(payday, month))
    setEditing(true)
  }

  const doSave = async (value: number, date: string) => {
    try {
      const res = await upsert.mutateAsync({
        profileId,
        month,
        amount: value,
        payDate: date,
      })
      if (res !== OFFLINE_QUEUED) toast.success('Salario guardado')
      setEditing(false)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = parseMoneyInput(amount)
    if (value === null) return
    // Guarda: la fecha de pago en un mes distinto al que se está viendo
    // es la causa de que una nómina se registre en el mes equivocado y
    // pise la del mes correcto. Se avisa antes de guardar.
    if (payDate.slice(0, 7) !== month.slice(0, 7)) {
      setDateMismatchOpen(true)
      return
    }
    await doSave(value, payDate)
  }

  const confirmDateMismatch = () => {
    setDateMismatchOpen(false)
    const value = parseMoneyInput(amount)
    if (value === null) return
    void doSave(value, payDate)
  }

  const handleDelete = async () => {
    if (!row) return
    try {
      const res = await remove.mutateAsync(row.id)
      if (res !== OFFLINE_QUEUED) toast.success('Salario eliminado')
      setConfirmOpen(false)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  if (!editing) {
    if (row) {
      return (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-right">
            <span className="text-sm font-semibold text-pine-600">
              {formatCurrency(Number(row.amount))}
            </span>
            {row.pay_date > todayISO() && (
              <p className="mt-0.5 text-xs text-ink/40">
                Llega el {Number(row.pay_date.slice(-2))} de{' '}
                {monthLabel(row.pay_date)}
              </p>
            )}
          </div>
          {canEdit && (
            <div className="flex gap-1">
              <button
                onClick={startEdit}
                className="rounded-lg p-3 text-ink/40 hover:bg-slate-100 hover:text-ink/55"
                aria-label="Editar salario"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => setConfirmOpen(true)}
                className="rounded-lg p-3 text-ink/40 hover:bg-coral-100/70 hover:text-coral-600"
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
              <span className="rounded-full bg-gold-100 px-2 py-0.5 text-xs font-medium text-gold-600">
                Estimado · {monthLabel(effective.source_month ?? month)}
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
              className="rounded-lg p-3 text-ink/40 hover:bg-slate-100 hover:text-ink/55"
              aria-label="Editar salario heredado"
            >
              <Pencil size={16} />
            </button>
          )}
        </div>
      )
    }
    if (!canEdit) {
      return <span className="text-sm text-ink/70">Sin salario</span>
    }
    return (
      <button
        onClick={startEdit}
        className="inline-flex min-h-11 items-center rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-ink/40 hover:border-pine-400 hover:text-pine-600"
      >
        + Registrar salario
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <MoneyInput
        label="Monto del salario"
        value={amount}
        onChange={setAmount}
        autoFocus
        className="w-full sm:w-40"
        placeholder="0.00"
      />
      <DateInput
        aria-label="Fecha real de pago"
        value={payDate}
        onChange={(e) => setPayDate(e.target.value)}
        className="w-full sm:w-48"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={upsert.isPending}
          className="inline-flex min-h-11 items-center rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800 disabled:opacity-50"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm text-ink/50 hover:bg-slate-100"
        >
          Cancelar
        </button>
      </div>
      <ConfirmDialog
        open={dateMismatchOpen}
        title="Fecha de pago en otro mes"
        message={`La fecha de pago (${formatDate(payDate)}) no está en ${monthLabel(month)}, el mes que estás viendo. Si es la nómina de otro mes, cambia el mes con el selector de arriba para no pisar el registro de este mes. ¿Guardarla aquí de todas formas?`}
        confirmLabel="Guardar aquí"
        onConfirm={confirmDateMismatch}
        onCancel={() => setDateMismatchOpen(false)}
        busy={upsert.isPending}
      />
    </form>
  )
}

import { usePageTitle } from '@/shared/hooks/usePageTitle'
import Fab from '@/shared/components/ui/Fab'
import { useMonthParam } from '@/shared/hooks/useMonthParam'
import { OFFLINE_QUEUED } from '@/shared/lib/offline/offlineSafe'

export default function Members() {
  usePageTitle('Miembros e ingresos')
  const { user } = useAuth()
  const [month, setMonth] = useMonthParam()
  const { data: household, error: householdError, refetch: refetchHousehold } = useHousehold()
  const {
    data: members,
    isLoading: membersLoading,
    error: membersError,
    refetch: refetchMembers,
  } = useMembers()
  const { salaries } = useSalaries(month)
  const updatePayday = useUpdatePayday()
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  if (householdError) {
    return <QueryError error={householdError} onRetry={refetchHousehold} />
  }
  if (!household || membersLoading) return <PageSkeleton />

  if (membersError) {
    return <QueryError error={membersError} onRetry={refetchMembers} />
  }

  const handlePaydayChange = (m: Profile) => async (e: { target: { value: string } }) => {
    const payday = Number(e.target.value)
    try {
      await updatePayday.mutateAsync({ profileId: m.id, payday })
      toast.success(`Día de pago: ${payday}`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const copyCode = async () => {
    await navigator.clipboard.writeText(household.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-up flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-ink">
            <Users size={24} className="text-pine-600" />
            Miembros e ingresos
          </h1>
          <p className="text-sm text-ink/50">
            Personas, día de pago e ingresos del hogar
          </p>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      <div className="animate-fade-up flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-pine-200 bg-pine-50 p-4" style={{ animationDelay: '90ms' }}>
        <div>
          <p className="text-sm font-medium text-pine-600">Invita a tu hogar</p>
          <p className="text-xs text-pine-600/70">
            Comparte el código con las personas que van a registrar gastos.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
            Código de invitación
          </p>
          <button
            onClick={copyCode}
            className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm font-semibold text-ink/70 shadow-sm hover:bg-cream"
          >
            {copied ? <Check size={16} className="text-pine-600" /> : <Copy size={16} />}
            {household.invite_code}
          </button>
        </div>
      </div>

      <Fab
        onClick={() =>
          document
            .getElementById('registrar-salario')
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        label="Registrar salario"
      />

      <div id="registrar-salario" className="card animate-fade-up scroll-mt-24" style={{ animationDelay: '260ms' }}>
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">
            Personas del hogar
          </h2>
          <p className="mt-0.5 text-xs text-ink/40">
            El día de pago define la ventana «Desde mi último pago». El monto
            del salario es opcional para calcularla.
          </p>
        </div>
        <ul className="divide-y divide-slate-100">
          {members?.map((m) => {
            const effective = salaries?.find((s) => s.profile_id === m.id)
            return (
              <li key={m.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar name={m.full_name} avatarPath={m.avatar_path} size="md" />
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
                      <div className="mt-1.5 flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                        <span className="text-xs text-ink/40">Día de pago</span>
                        <SelectInput
                          aria-label="Día de pago"
                          value={m.payday ?? 1}
                          onChange={handlePaydayChange(m)}
                          className="w-full sm:w-28"
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

      <IncomeSection month={month} members={members} />
    </div>
  )
}
