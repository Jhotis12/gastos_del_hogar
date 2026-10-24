import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createSavingsMovement,
  runDueSavings,
  savingsMovementsKey,
  savingsPlansKey,
  type SavingsRpcClient,
} from '../../src/modules/savings/lib/savingsApi.ts'

test('claves de movimientos y planes', () => {
  assert.deepEqual(savingsMovementsKey('h1', 'g1'), [
    'savings-movements',
    'h1',
    'g1',
  ])
  assert.deepEqual(savingsMovementsKey('h1'), [
    'savings-movements',
    'h1',
    'all',
  ])
  assert.deepEqual(savingsPlansKey('h1'), ['savings-plans', 'h1'])
})

test('createSavingsMovement normaliza el monto y llama al RPC', async () => {
  const calls: Array<[string, Record<string, unknown> | undefined]> = []
  const client: SavingsRpcClient = {
    rpc: async (fn, args) => {
      calls.push([fn, args])
      return { data: 'movement-id', error: null }
    },
  }

  await createSavingsMovement(client, {
    goalId: 'g1',
    amount: -50000,
    kind: 'withdrawal',
    movementDate: '2026-10-24',
  })

  assert.deepEqual(calls, [
    [
      'create_savings_movement',
      {
        p_goal_id: 'g1',
        p_amount: 50000,
        p_kind: 'withdrawal',
        p_movement_date: '2026-10-24',
      },
    ],
  ])
})

test('createSavingsMovement propaga el error', async () => {
  const client: SavingsRpcClient = {
    rpc: async () => ({ data: null, error: new Error('saldo insuficiente') }),
  }
  await assert.rejects(
    createSavingsMovement(client, {
      goalId: 'g1',
      amount: 50000,
      kind: 'withdrawal',
      movementDate: '2026-10-24',
    }),
    /saldo insuficiente/,
  )
})

test('runDueSavings normaliza los counts y el caso vacío', async () => {
  const client: SavingsRpcClient = {
    rpc: async () => ({ data: [{ created: '2', skipped: 1 }], error: null }),
  }
  assert.deepEqual(await runDueSavings(client), { created: 2, skipped: 1 })

  const empty: SavingsRpcClient = {
    rpc: async () => ({ data: [], error: null }),
  }
  assert.deepEqual(await runDueSavings(empty), { created: 0, skipped: 0 })
})
