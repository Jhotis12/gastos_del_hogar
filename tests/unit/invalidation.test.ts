import assert from 'node:assert/strict'
import test from 'node:test'
import { QueryClient } from '@tanstack/react-query'
import {
  LEDGER_INVALIDATION,
  invalidateLedger,
} from '../../src/shared/lib/queryInvalidation.ts'

function spyQueryClient() {
  const queryClient = new QueryClient()
  const calls: string[][] = []
  queryClient.invalidateQueries = ((filters: {
    queryKey?: readonly unknown[]
  }) => {
    calls.push([...(filters.queryKey ?? [])] as string[])
    return Promise.resolve()
  }) as typeof queryClient.invalidateQueries
  return { queryClient, calls }
}

test('las mutaciones de ahorro invalidan ahorro y ledger personal', () => {
  const { queryClient, calls } = spyQueryClient()
  invalidateLedger(queryClient, LEDGER_INVALIDATION.savings)

  assert.deepEqual(calls, [
    ['savings'],
    ['savings-movements'],
    ['savings-plans'],
    ['member-available'],
    ['personal-history'],
    ['household-history'],
  ])
})

test('gastos, ingresos y salarios invalidan disponible e historiales', () => {
  for (const group of ['expenses', 'incomes', 'salaries'] as const) {
    const keys = LEDGER_INVALIDATION[group].map(([key]) => key)
    assert.ok(keys.includes('member-available'), group)
    assert.ok(keys.includes('personal-history'), group)
    assert.ok(keys.includes('household-history'), group)
    assert.ok(keys.includes(group), group)
  }
})

test('el cambio de payday refresca miembros, ventanas y ledger', () => {
  const keys = LEDGER_INVALIDATION.payday.map(([key]) => key)
  assert.ok(keys.includes('members'))
  assert.ok(keys.includes('salaries'))
  assert.ok(keys.includes('member-available'))
  assert.ok(keys.includes('personal-history'))
})
