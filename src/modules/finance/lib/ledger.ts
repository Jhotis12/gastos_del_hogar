export type LedgerExpense = {
  amount: number
  paid_by: string | null
  category_id: string | null
}

export type PayerTotal = { memberId: string | null; total: number }

export type CategoryTotal = {
  categoryId: string | null
  total: number
  share: number
}

const toCents = (amount: number) => Math.round(amount * 100)
const toMoney = (cents: number) => cents / 100

export function householdTotal(expenses: LedgerExpense[]): number {
  return toMoney(expenses.reduce((sum, expense) => sum + toCents(expense.amount), 0))
}

export function personalTotal(
  expenses: LedgerExpense[],
  memberId: string,
): number {
  return toMoney(
    expenses
      .filter((expense) => expense.paid_by === memberId)
      .reduce((sum, expense) => sum + toCents(expense.amount), 0),
  )
}

export function payerBreakdown(expenses: LedgerExpense[]): PayerTotal[] {
  const totals = new Map<string | null, number>()

  for (const expense of expenses) {
    totals.set(
      expense.paid_by,
      (totals.get(expense.paid_by) ?? 0) + toCents(expense.amount),
    )
  }

  return [...totals]
    .map(([memberId, cents]) => ({ memberId, total: toMoney(cents) }))
    .sort((a, b) => {
      if (a.total !== b.total) return b.total - a.total
      if (a.memberId === b.memberId) return 0
      if (a.memberId === null) return 1
      if (b.memberId === null) return -1
      return a.memberId.localeCompare(b.memberId)
    })
}

export function categoryBreakdown(
  expenses: LedgerExpense[],
  memberId?: string,
): CategoryTotal[] {
  const filtered = memberId
    ? expenses.filter((expense) => expense.paid_by === memberId)
    : expenses
  const totalCents = filtered.reduce(
    (sum, expense) => sum + toCents(expense.amount),
    0,
  )
  const totals = new Map<string | null, number>()

  for (const expense of filtered) {
    totals.set(
      expense.category_id,
      (totals.get(expense.category_id) ?? 0) + toCents(expense.amount),
    )
  }

  return [...totals]
    .map(([categoryId, cents]) => ({
      categoryId,
      total: toMoney(cents),
      share:
        totalCents === 0
          ? 0
          : Math.round((cents / totalCents) * 10000) / 10000,
    }))
    .sort((a, b) => {
      if (a.total !== b.total) return b.total - a.total
      if (a.categoryId === b.categoryId) return 0
      if (a.categoryId === null) return 1
      if (b.categoryId === null) return -1
      return a.categoryId.localeCompare(b.categoryId)
    })
}

export function householdReconciliation(expenses: LedgerExpense[]): {
  total: number
  perPerson: number
  unassigned: number
  reconciles: boolean
} {
  const totalCents = expenses.reduce(
    (sum, expense) => sum + toCents(expense.amount),
    0,
  )
  const unassignedCents = expenses
    .filter((expense) => expense.paid_by === null)
    .reduce((sum, expense) => sum + toCents(expense.amount), 0)
  const perPersonCents = totalCents - unassignedCents

  return {
    total: toMoney(totalCents),
    perPerson: toMoney(perPersonCents),
    unassigned: toMoney(unassignedCents),
    reconciles: perPersonCents + unassignedCents === totalCents,
  }
}
