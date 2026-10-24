export type MemberAvailable = {
  available: number | null
  income_basis: number
  last_pay_date: string | null
}

type MemberAvailableRow = {
  available: number | string | null
  income_basis: number | string | null
  last_pay_date: string | null
}

type RpcResponse = {
  data: unknown
  error: unknown
}

export type MemberAvailableClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResponse>
}

export const EMPTY_MEMBER_AVAILABLE: MemberAvailable = {
  available: null,
  income_basis: 0,
  last_pay_date: null,
}

export function memberAvailableKey(
  householdId: string | null | undefined,
  memberId: string | null | undefined,
  asOf: string,
): readonly ['member-available', string | null | undefined, string | null | undefined, string] {
  return ['member-available', householdId, memberId, asOf]
}

// El RPC devuelve una tabla de una fila; se normaliza aquí para que el hook
// y las pruebas compartan el mismo contrato.
export async function fetchMemberAvailable(
  client: MemberAvailableClient,
  asOf: string,
): Promise<MemberAvailable> {
  const { data, error } = await client.rpc('get_member_available', {
    p_as_of: asOf,
  })
  if (error) throw error

  const row = (data as MemberAvailableRow[] | null)?.[0]
  if (!row) return EMPTY_MEMBER_AVAILABLE

  return {
    available: row.available === null ? null : Number(row.available),
    income_basis: Number(row.income_basis ?? 0),
    last_pay_date: row.last_pay_date,
  }
}
