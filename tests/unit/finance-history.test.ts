import assert from 'node:assert/strict'
import test from 'node:test'
import {
  fetchHouseholdMonthlyHistory,
  fetchPersonalMonthlyHistory,
  householdHistoryKey,
  mapMonthlyHistory,
  personalHistoryKey,
  type HistoryClient,
} from '../../src/modules/finance/lib/history.ts'

test('claves de historial por hogar y miembro', () => {
  assert.deepEqual(personalHistoryKey('h1', 'm1'), [
    'personal-history',
    'h1',
    'm1',
  ])
  assert.deepEqual(householdHistoryKey('h1'), ['household-history', 'h1'])
})

test('mapMonthlyHistory normaliza numéricos', () => {
  assert.deepEqual(
    mapMonthlyHistory([
      {
        month: '2026-10-01',
        income: '3600000.00',
        expenses: 1200000,
        savings: '450000.00',
        free: '1950000.00',
        accumulated: '4950000.00',
      },
    ]),
    [
      {
        month: '2026-10-01',
        income: 3600000,
        expenses: 1200000,
        savings: 450000,
        free: 1950000,
        accumulated: 4950000,
      },
    ],
  )
  assert.deepEqual(mapMonthlyHistory(null), [])
})

test('los fetchers llaman al RPC correcto y propagan errores', async () => {
  const calls: string[] = []
  const client: HistoryClient = {
    rpc: async (fn) => {
      calls.push(fn)
      return { data: [], error: null }
    },
  }

  await fetchPersonalMonthlyHistory(client)
  await fetchHouseholdMonthlyHistory(client)
  assert.deepEqual(calls, [
    'get_personal_monthly_history',
    'get_household_monthly_history',
  ])

  const failing: HistoryClient = {
    rpc: async () => ({ data: null, error: new Error('query failed') }),
  }
  await assert.rejects(fetchPersonalMonthlyHistory(failing), /query failed/)
})
