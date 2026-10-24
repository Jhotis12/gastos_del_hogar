export type InvalidationKeys = string[][]

// Claves que refrescan el ledger v2 y las vistas v1 que aún las consumen.
export const LEDGER_INVALIDATION = {
  expenses: [
    ['expenses'],
    ['member-available'],
    ['personal-history'],
    ['household-history'],
    ['running-balance'],
    ['monthly-surpluses'],
  ],
  incomes: [
    ['incomes'],
    ['member-available'],
    ['personal-history'],
    ['household-history'],
    ['running-balance'],
    ['monthly-surpluses'],
  ],
  salaries: [
    ['salaries'],
    ['member-available'],
    ['personal-history'],
    ['household-history'],
    ['running-balance'],
    ['monthly-surpluses'],
  ],
  payday: [
    ['members'],
    ['salaries'],
    ['member-available'],
    ['personal-history'],
    ['household-history'],
    ['running-balance'],
    ['monthly-surpluses'],
  ],
  savings: [
    ['savings'],
    ['savings-movements'],
    ['savings-plans'],
    ['member-available'],
    ['personal-history'],
    ['household-history'],
  ],
} satisfies Record<string, InvalidationKeys>

export type QueryInvalidator = {
  invalidateQueries: (filters: { queryKey: string[] }) => unknown
}

export function invalidateLedger(
  client: QueryInvalidator,
  keys: InvalidationKeys,
): void {
  for (const queryKey of keys) client.invalidateQueries({ queryKey })
}
