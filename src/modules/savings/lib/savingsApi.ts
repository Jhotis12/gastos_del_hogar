export type SavingsMovementInput = {
  goalId: string
  amount: number
  kind: 'deposit' | 'withdrawal'
  movementDate: string
}

type RpcResponse = {
  data: unknown
  error: unknown
}

export type SavingsRpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<RpcResponse>
}

export function savingsMovementsKey(
  householdId: string | null | undefined,
  goalId?: string | null,
): readonly ['savings-movements', string | null | undefined, string] {
  return ['savings-movements', householdId, goalId ?? 'all']
}

export function savingsPlansKey(
  householdId: string | null | undefined,
): readonly ['savings-plans', string | null | undefined] {
  return ['savings-plans', householdId]
}

export async function createSavingsMovement(
  client: SavingsRpcClient,
  input: SavingsMovementInput,
): Promise<void> {
  const { error } = await client.rpc('create_savings_movement', {
    p_goal_id: input.goalId,
    p_amount: Math.abs(input.amount),
    p_kind: input.kind,
    p_movement_date: input.movementDate,
  })
  if (error) throw error
}

export async function runDueSavings(
  client: SavingsRpcClient,
): Promise<{ created: number; skipped: number }> {
  const { data, error } = await client.rpc('run_due_savings')
  if (error) throw error

  const row = (data as Array<{ created: number | string; skipped: number | string }> | null)?.[0]
  return {
    created: Number(row?.created ?? 0),
    skipped: Number(row?.skipped ?? 0),
  }
}
