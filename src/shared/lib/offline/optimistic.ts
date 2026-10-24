import type { QueryClient } from '@tanstack/react-query'
import { enqueueOp } from './queue'
import { refreshPendingCount, syncNow } from './sync'
import { emitToast } from '@/shared/components/ui/Toast'
import type { ExpenseWithRelations, IncomeWithRelations, Profile, Salary } from '@/shared/lib/types'

// Encola la operación + actualización optimista de la caché: la fila
// aparece al instante aunque no haya red. El id se genera en el cliente
// para que el replay no duplique filas y el realtime converja en sitio.

function afterEnqueue(): void {
  emitToast('success', 'Guardado sin conexión')
  void refreshPendingCount().then(() => {
    if (navigator.onLine) setTimeout(() => void syncNow(), 400)
  })
}

function monthKeyOf(dateIso: string): string {
  return `${dateIso.slice(0, 7)}-01`
}

type FinanceWindowCache = {
  expenses: ExpenseWithRelations[]
  incomes: IncomeWithRelations[]
}

type MemberAvailableCache = {
  available: number | null
  income_basis: number
  last_pay_date: string | null
}

type HistoryCache = {
  month: string
  income: number
  expenses: number
  savings: number
  free: number
  accumulated: number
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

// Refleja un gasto nuevo en las cachés v2 (ventana personal, disponible e
// historiales) antes de que el sync hable con el servidor.
function applyExpenseToFinanceCaches(
  queryClient: QueryClient,
  householdId: string,
  row: ExpenseWithRelations,
  amount: number,
): void {
  const month = monthKeyOf(row.expense_date)

  for (const [key, data] of queryClient.getQueriesData<FinanceWindowCache>({
    queryKey: ['finance-window', householdId],
  })) {
    const start = key[3]
    const end = key[4]
    if (
      data &&
      typeof start === 'string' &&
      typeof end === 'string' &&
      row.expense_date >= start &&
      row.expense_date <= end
    ) {
      queryClient.setQueryData(key, {
        ...data,
        expenses: [row, ...data.expenses],
      })
    }
  }

  for (const [key, data] of queryClient.getQueriesData<MemberAvailableCache>({
    queryKey: ['member-available', householdId],
  })) {
    if (data && key[2] === row.paid_by && data.available !== null) {
      queryClient.setQueryData(key, {
        ...data,
        available: roundMoney(data.available - amount),
      })
    }
  }

  const historyKeys: string[][] = [
    ['household-history', householdId],
    ['personal-history', householdId, row.paid_by ?? ''],
  ]
  for (const historyKey of historyKeys) {
    for (const [key, data] of queryClient.getQueriesData<HistoryCache[]>({
      queryKey: historyKey,
    })) {
      if (!data) continue
      if (historyKey[0] === 'personal-history' && key[2] !== row.paid_by) continue
      queryClient.setQueryData(
        key,
        data.map((monthRow) =>
          monthRow.month >= month
            ? {
                ...monthRow,
                expenses:
                  monthRow.month === month
                    ? roundMoney(monthRow.expenses + amount)
                    : monthRow.expenses,
                free:
                  monthRow.month === month
                    ? roundMoney(monthRow.free - amount)
                    : monthRow.free,
                accumulated: roundMoney(monthRow.accumulated - amount),
              }
            : monthRow,
        ),
      )
    }
  }
}

// ---------- Gastos ----------

type ExpenseInput = {
  amount: number
  description: string
  category_id: string | null
  paid_by: string | null
  expense_date: string
  receipt_id?: string | null
}

export function enqueueExpenseAdd(
  queryClient: QueryClient,
  householdId: string,
  input: ExpenseInput,
  id = crypto.randomUUID(),
): void {
  void enqueueOp({
    entity: 'expenses',
    op: 'add',
    rowId: id,
    payload: { ...input, id, household_id: householdId },
  })
  const members =
    queryClient.getQueryData<Profile[]>(['members', householdId]) ?? []
  const payer = members.find((member) => member.id === input.paid_by) ?? null
  const optimisticRow: ExpenseWithRelations = {
    id,
    household_id: householdId,
    amount: input.amount,
    description: input.description,
    category_id: input.category_id ?? null,
    paid_by: input.paid_by ?? null,
    expense_date: input.expense_date,
    receipt_id: input.receipt_id ?? null,
    recurring_id: null,
    created_at: new Date().toISOString(),
    category: null,
    payer: payer
      ? {
          id: payer.id,
          full_name: payer.full_name,
          avatar_path: payer.avatar_path ?? null,
        }
      : null,
    recurring: null,
    receipt: null,
  }

  queryClient.setQueryData<ExpenseWithRelations[]>(
    ['expenses', householdId, monthKeyOf(input.expense_date)],
    (old = []) => [optimisticRow, ...old],
  )
  applyExpenseToFinanceCaches(
    queryClient,
    householdId,
    optimisticRow,
    Number(input.amount),
  )
  afterEnqueue()
}

export function enqueueExpenseUpdate(
  queryClient: QueryClient,
  id: string,
  input: ExpenseInput,
): void {
  void enqueueOp({
    entity: 'expenses',
    op: 'update',
    rowId: id,
    payload: { id, ...input },
  })
  queryClient.setQueriesData<ExpenseWithRelations[]>({ queryKey: ['expenses'] }, (old) =>
    old?.map((e) =>
      e.id === id
        ? {
            ...e,
            ...input,
            category_id: input.category_id ?? null,
            paid_by: input.paid_by ?? null,
          }
        : e,
    ),
  )
  afterEnqueue()
}

export function enqueueExpenseDelete(queryClient: QueryClient, id: string): void {
  void enqueueOp({ entity: 'expenses', op: 'delete', rowId: id, payload: { id } })
  queryClient.setQueriesData<ExpenseWithRelations[]>({ queryKey: ['expenses'] }, (old) =>
    old?.filter((e) => e.id !== id),
  )
  afterEnqueue()
}

// ---------- Dinero extra ----------

type IncomeInput = {
  amount: number
  description: string
  member_id: string | null
  income_date: string
}

export function enqueueIncomeAdd(
  queryClient: QueryClient,
  householdId: string,
  input: IncomeInput,
  id = crypto.randomUUID(),
): void {
  void enqueueOp({
    entity: 'incomes',
    op: 'add',
    rowId: id,
    payload: { ...input, id, household_id: householdId },
  })
  queryClient.setQueryData<IncomeWithRelations[]>(
    ['incomes', householdId, monthKeyOf(input.income_date)],
    (old = []) => [
      {
        id,
        household_id: householdId,
        amount: input.amount,
        description: input.description,
        member_id: input.member_id ?? null,
        income_date: input.income_date,
        created_at: new Date().toISOString(),
        member: null,
      },
      ...old,
    ],
  )
  afterEnqueue()
}

export function enqueueIncomeUpdate(
  queryClient: QueryClient,
  id: string,
  input: IncomeInput,
): void {
  void enqueueOp({
    entity: 'incomes',
    op: 'update',
    rowId: id,
    payload: { id, ...input },
  })
  queryClient.setQueriesData<IncomeWithRelations[]>({ queryKey: ['incomes'] }, (old) =>
    old?.map((i) =>
      i.id === id
        ? { ...i, ...input, member_id: input.member_id ?? null }
        : i,
    ),
  )
  afterEnqueue()
}

export function enqueueIncomeDelete(queryClient: QueryClient, id: string): void {
  void enqueueOp({ entity: 'incomes', op: 'delete', rowId: id, payload: { id } })
  queryClient.setQueriesData<IncomeWithRelations[]>({ queryKey: ['incomes'] }, (old) =>
    old?.filter((i) => i.id !== id),
  )
  afterEnqueue()
}

// ---------- Salarios ----------

export function enqueueSalaryUpsert(
  queryClient: QueryClient,
  householdId: string,
  input: { amount: number; month: string; profileId: string; payDate: string },
): void {
  const id = crypto.randomUUID()
  void enqueueOp({
    entity: 'salaries',
    op: 'add',
    rowId: id,
    payload: {
      household_id: householdId,
      profile_id: input.profileId,
      amount: input.amount,
      month: input.month,
      pay_date: input.payDate,
      id,
    },
  })
  const row: Salary = {
    id,
    household_id: householdId,
    profile_id: input.profileId,
    amount: input.amount,
    month: input.month,
    pay_date: input.payDate,
    created_at: new Date().toISOString(),
  }
  queryClient.setQueriesData<Salary[]>({ queryKey: ['salaries'] }, (old) => {
    const rows = old ?? []
    const idx = rows.findIndex(
      (s) => s.profile_id === input.profileId && s.month === input.month,
    )
    if (idx >= 0) {
      const copy = [...rows]
      copy[idx] = row
      return copy
    }
    return [...rows, row]
  })
  afterEnqueue()
}

export function enqueueSalaryDelete(queryClient: QueryClient, id: string): void {
  void enqueueOp({ entity: 'salaries', op: 'delete', rowId: id, payload: { id } })
  queryClient.setQueriesData<Salary[]>({ queryKey: ['salaries'] }, (old) =>
    old?.filter((s) => s.id !== id),
  )
  afterEnqueue()
}
