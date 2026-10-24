import assert from 'node:assert/strict'
import test from 'node:test'
import { financeWindow } from '../../src/modules/finance/lib/financeWindow.ts'

test('la unión cubre el mes y el ciclo desde el pago', () => {
  const window = financeWindow({
    payday: 30,
    salaries: [{ pay_date: '2026-09-30' }],
    asOf: '2026-10-02',
  })

  assert.deepEqual(window.month, {
    start: '2026-10-01',
    end: '2026-10-02',
  })
  assert.deepEqual(window.cycle, {
    start: '2026-09-30',
    end: '2026-10-02',
  })
  assert.deepEqual(window.union, {
    start: '2026-09-30',
    end: '2026-10-02',
  })
})

test('la ventana que cruza meses incluye filas de ambos meses', () => {
  const { union } = financeWindow({
    salaries: [{ pay_date: '2026-09-30' }],
    asOf: '2026-10-02',
  })

  const rows = [
    { date: '2026-09-29' },
    { date: '2026-09-30' },
    { date: '2026-10-01' },
    { date: '2026-10-03' },
  ]
  const included = rows
    .filter((row) => row.date >= union.start && row.date <= union.end)
    .map((row) => row.date)

  assert.deepEqual(included, ['2026-09-30', '2026-10-01'])
})

test('sin nómina usa el payday y también puede cruzar el mes', () => {
  const window = financeWindow({
    payday: 27,
    salaries: [],
    asOf: '2026-10-10',
  })

  assert.deepEqual(window.cycle, {
    start: '2026-09-27',
    end: '2026-10-10',
  })
  assert.deepEqual(window.union, window.cycle)
})

test('si el ciclo cabe en el mes, la unión es el mes', () => {
  const window = financeWindow({
    payday: 1,
    salaries: [],
    asOf: '2026-10-24',
  })

  assert.deepEqual(window.union, {
    start: '2026-10-01',
    end: '2026-10-24',
  })
})
