export type MonthlyHistory = {
  month: string
  income: number
  expenses: number
  savings: number
  free: number
  accumulated: number
}

type MonthlyHistoryRow = {
  month: string
  income: number | string | null
  expenses: number | string | null
  savings: number | string | null
  free: number | string | null
  accumulated: number | string | null
}

type HistoryResponse = {
  data: unknown
  error: unknown
}

export type HistoryClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<HistoryResponse>
}

export function personalHistoryKey(
  householdId: string | null | undefined,
  memberId: string | null | undefined,
): readonly ['personal-history', string | null | undefined, string | null | undefined] {
  return ['personal-history', householdId, memberId]
}

export function householdHistoryKey(
  householdId: string | null | undefined,
): readonly ['household-history', string | null | undefined] {
  return ['household-history', householdId]
}

export function mapMonthlyHistory(data: unknown): MonthlyHistory[] {
  const rows = Array.isArray(data) ? (data as MonthlyHistoryRow[]) : []
  return rows.map((row) => ({
    month: row.month,
    income: Number(row.income ?? 0),
    expenses: Number(row.expenses ?? 0),
    savings: Number(row.savings ?? 0),
    free: Number(row.free ?? 0),
    accumulated: Number(row.accumulated ?? 0),
  }))
}

async function fetchHistory(
  client: HistoryClient,
  fn: 'get_personal_monthly_history' | 'get_household_monthly_history',
): Promise<MonthlyHistory[]> {
  const { data, error } = await client.rpc(fn)
  if (error) throw error
  return mapMonthlyHistory(data)
}

export function fetchPersonalMonthlyHistory(
  client: HistoryClient,
): Promise<MonthlyHistory[]> {
  return fetchHistory(client, 'get_personal_monthly_history')
}

export function fetchHouseholdMonthlyHistory(
  client: HistoryClient,
): Promise<MonthlyHistory[]> {
  return fetchHistory(client, 'get_household_monthly_history')
}
