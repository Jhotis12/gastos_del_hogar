import assert from 'node:assert/strict'
import test from 'node:test'
import {
  categoryBreakdown,
  householdReconciliation,
  householdTotal,
  payerBreakdown,
  personalTotal,
  type LedgerExpense,
} from '../../src/modules/finance/lib/ledger.ts'

const expenses: LedgerExpense[] = [
  { amount: 100000, paid_by: 'a', category_id: 'comida' },
  { amount: 250000, paid_by: 'b', category_id: 'transporte' },
  { amount: 25000, paid_by: null, category_id: 'comida' },
  { amount: 50000, paid_by: 'b', category_id: 'comida' },
]

test('total del hogar y total personal', () => {
  assert.equal(householdTotal(expenses), 425000)
  assert.equal(personalTotal(expenses, 'a'), 100000)
  assert.equal(personalTotal(expenses, 'b'), 300000)
  assert.equal(personalTotal(expenses, 'nadie'), 0)
})

test('desglose por persona incluye Sin asignar y reconcilia', () => {
  const byPayer = payerBreakdown(expenses)
  assert.deepEqual(
    byPayer.map((row) => [row.memberId, row.total]),
    [
      ['b', 300000],
      ['a', 100000],
      [null, 25000],
    ],
  )

  const result = householdReconciliation(expenses)
  assert.equal(result.total, 425000)
  assert.equal(result.perPerson, 400000)
  assert.equal(result.unassigned, 25000)
  assert.equal(result.reconciles, true)
})

test('cambiar el pagador mueve el total sin cambiar el del hogar', () => {
  const moved: LedgerExpense[] = [
    { amount: 40000, paid_by: 'b', category_id: 'comida' },
  ]
  const before: LedgerExpense[] = [
    { amount: 40000, paid_by: 'a', category_id: 'comida' },
  ]

  assert.equal(personalTotal(before, 'a'), 40000)
  assert.equal(personalTotal(moved, 'b'), 40000)
  assert.equal(householdTotal(before), householdTotal(moved))
})

test('desglose por categoría y participación', () => {
  assert.deepEqual(categoryBreakdown(expenses), [
    { categoryId: 'transporte', total: 250000, share: 0.5882 },
    { categoryId: 'comida', total: 175000, share: 0.4118 },
  ])

  assert.deepEqual(categoryBreakdown(expenses, 'a'), [
    { categoryId: 'comida', total: 100000, share: 1 },
  ])
})

test('redondeo de centavos y caso vacío', () => {
  const cents: LedgerExpense[] = [
    { amount: 0.1, paid_by: 'a', category_id: null },
    { amount: 0.2, paid_by: null, category_id: null },
  ]

  assert.equal(householdTotal(cents), 0.3)
  assert.equal(householdTotal([]), 0)
  assert.equal(householdReconciliation([]).reconciles, true)
  assert.deepEqual(categoryBreakdown([]), [])
})
