export type HouseholdAvailable = {
  available: number | null
}

type HouseholdAvailableRow = {
  available: number | string | null
}

type RpcResponse = {
  data: unknown
  error: unknown
}

export type HouseholdAvailableClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResponse>
}

export function householdAvailableKey(
  householdId: string | null | undefined,
  asOf: string,
): readonly ['household-available', string | null | undefined, string] {
  return ['household-available', householdId, asOf]
}

export async function fetchHouseholdAvailable(
  client: HouseholdAvailableClient,
  asOf: string,
): Promise<HouseholdAvailable> {
  const { data, error } = await client.rpc('get_household_available', {
    p_as_of: asOf,
  })
  if (error) throw error

  const row = (data as HouseholdAvailableRow[] | null)?.[0]
  return { available: row?.available == null ? null : Number(row.available) }
}
