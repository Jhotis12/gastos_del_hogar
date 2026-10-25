import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AVG_DAYS_PER_MONTH,
  dailyBudget,
  fixedCommitmentsUntil,
  projectCycle,
  savedAwayTotal,
  savingsCommitmentsUntil,
  scaleRangeToDays,
  variableBaseline,
} from '../../src/modules/forecast/lib/forecast.ts'

const MONTH = '2026-10-01'

function expense(
  date: string,
  amount: number,
  description = 'Mercado',
  categoryId: string | null = null,
) {
  return {
    expense_date: date,
    amount,
    description,
    category_id: categoryId,
  }
}

test('variableBaseline incluye meses en cero y calcula mediana y rango', () => {
  const result = variableBaseline(
    [
      expense('2026-04-15', 1000),
      expense('2026-06-15', 2000),
      expense('2026-07-15', 3000),
      expense('2026-08-15', 4000),
      expense('2026-09-15', 5000),
    ],
    MONTH,
  )

  assert.equal(result.months.length, 6)
  assert.deepEqual(
    result.months.map((month) => month.total),
    [1000, 0, 2000, 3000, 4000, 5000],
  )
  assert.deepEqual(result.range, { median: 2500, low: 1250, high: 3750 })
})

test('variableBaseline queda en null con menos de 2 meses completos', () => {
  const result = variableBaseline([expense('2026-09-15', 1000)], MONTH)

  assert.deepEqual(result.months, [{ month: '2026-09-01', total: 1000 }])
  assert.equal(result.range, null)
})

test('variableBaseline excluye un gasto que hoy es un servicio recurrente', () => {
  const result = variableBaseline(
    [
      expense('2026-04-10', 100_000, 'Internet'),
      expense('2026-04-20', 2_000, 'Mercado'),
      expense('2026-05-10', 2_000, 'Mercado'),
    ],
    MONTH,
    [{ description: 'internet', category_id: null }],
  )

  assert.equal(
    result.months.find((month) => month.month === '2026-04-01')?.total,
    2_000,
  )
})

test('variableBaseline excluye los gastos ya vinculados a un recurrente', () => {
  const result = variableBaseline(
    [
      {
        ...expense('2026-04-10', 50_000, 'Servicio aplicado'),
        recurring_id: 'rec-1',
      },
      expense('2026-04-20', 2_000, 'Mercado'),
      expense('2026-05-10', 2_000, 'Mercado'),
    ],
    MONTH,
  )

  assert.equal(
    result.months.find((month) => month.month === '2026-04-01')?.total,
    2_000,
  )
})

test('variableBaseline usa la categoría cuando la descripción está vacía', () => {
  const result = variableBaseline(
    [
      expense('2026-04-10', 5_000, '', 'servicios'),
      expense('2026-04-20', 2_000, 'Mercado', 'comida'),
      expense('2026-05-10', 2_000, 'Mercado', 'comida'),
    ],
    MONTH,
    [{ description: '', category_id: 'servicios' }],
  )

  assert.equal(
    result.months.find((month) => month.month === '2026-04-01')?.total,
    2_000,
  )
})

test('scaleRangeToDays escala el rango mensual a los días restantes', () => {
  const scaled = scaleRangeToDays(
    { median: 1000, low: 500, high: 1500 },
    AVG_DAYS_PER_MONTH,
  )

  assert.deepEqual(scaled, { median: 1000, low: 500, high: 1500 })
  const half = scaleRangeToDays({ median: 1000, low: 500, high: 1500 }, 15.22)
  assert.equal(half.median, 500)
  assert.equal(half.low, 250)
  assert.equal(half.high, 750)
})

test('fixedCommitmentsUntil incluye vencidos y omite otros pagadores', () => {
  const services = [
    {
      id: 'luz',
      description: 'Luz',
      amount: 100_000,
      next_due_date: '2026-10-28',
      is_active: true,
      paid_by: 'me',
    },
    {
      id: 'agua',
      description: 'Agua',
      amount: 50_000,
      next_due_date: '2026-10-20',
      is_active: true,
      paid_by: 'me',
    },
    {
      id: 'otro',
      description: 'Otro',
      amount: 80_000,
      next_due_date: '2026-10-28',
      is_active: true,
      paid_by: 'otro',
    },
    {
      id: 'inactivo',
      description: 'Inactivo',
      amount: 30_000,
      next_due_date: '2026-10-28',
      is_active: false,
      paid_by: 'me',
    },
    {
      id: 'futuro',
      description: 'Futuro',
      amount: 20_000,
      next_due_date: '2026-11-05',
      is_active: true,
      paid_by: 'me',
    },
  ] as unknown as Parameters<typeof fixedCommitmentsUntil>[0]

  const result = fixedCommitmentsUntil(services, 'me', '2026-10-24', '2026-10-30')

  assert.deepEqual(
    result.map((item) => [item.id, item.dueDate, item.overdue]),
    [
      ['agua', '2026-10-20', true],
      ['luz', '2026-10-28', false],
    ],
  )
})

test('savingsCommitmentsUntil separa pendientes de ya ejecutados', () => {
  const goals = [
    {
      id: 'viaje',
      name: 'Viaje',
      target_amount: 1_000_000,
      saved_amount: 0,
      archived_at: null,
    },
    {
      id: 'llena',
      name: 'Llena',
      target_amount: 100,
      saved_amount: 100,
      archived_at: null,
    },
    {
      id: 'archivada',
      name: 'Archivada',
      target_amount: 1_000_000,
      saved_amount: 0,
      archived_at: '2026-10-01',
    },
  ] as unknown as Parameters<typeof savingsCommitmentsUntil>[1]

  const plans = [
    {
      id: 'p1',
      goal_id: 'viaje',
      member_id: 'me',
      amount: 200_000,
      day_of_month: 1,
      is_active: true,
      start_month: '2026-10-01',
      last_run_month: '2026-10-01',
    },
    {
      id: 'p2',
      goal_id: 'viaje',
      member_id: 'otro',
      amount: 300_000,
      day_of_month: 1,
      is_active: true,
      start_month: '2026-10-01',
      last_run_month: null,
    },
    {
      id: 'p3',
      goal_id: 'llena',
      member_id: 'me',
      amount: 400_000,
      day_of_month: 1,
      is_active: true,
      start_month: '2026-10-01',
      last_run_month: null,
    },
    {
      id: 'p4',
      goal_id: 'archivada',
      member_id: 'me',
      amount: 500_000,
      day_of_month: 1,
      is_active: true,
      start_month: '2026-10-01',
      last_run_month: null,
    },
  ] as unknown as Parameters<typeof savingsCommitmentsUntil>[0]

  const result = savingsCommitmentsUntil(
    plans,
    goals,
    'me',
    '2026-10-24',
    '2026-11-30',
  )

  assert.deepEqual(
    result.pending.map((item) => [item.id, item.dueDate, item.amount]),
    [['p1:2026-11-01', '2026-11-01', 200_000]],
  )
  assert.deepEqual(
    result.alreadyRun.map((item) => [item.id, item.dueDate, item.amount]),
    [['p1:2026-10-01', '2026-10-01', 200_000]],
  )
  assert.equal(result.pendingTotal, 200_000)
  assert.equal(result.alreadyRunTotal, 200_000)
})

test('savedAwayTotal suma metas personales y aportes netos a compartidas', () => {
  const goals = [
    { id: 'personal', owner_id: 'me', saved_amount: 200_000 },
    { id: 'compartida', owner_id: null, saved_amount: 500_000 },
  ] as unknown as Parameters<typeof savedAwayTotal>[0]
  const movements = [
    { member_id: 'me', goal_id: 'personal', amount: 50_000 },
    { member_id: 'me', goal_id: 'compartida', amount: 100_000 },
    { member_id: 'me', goal_id: 'compartida', amount: -20_000 },
    { member_id: 'otro', goal_id: 'compartida', amount: 300_000 },
  ]

  assert.equal(savedAwayTotal(goals, movements, 'me'), 280_000)
})

test('projectCycle alcanza cuando el rango pesimista queda en positivo', () => {
  const result = projectCycle({
    available: 1_000_000,
    incomeBefore: 0,
    fixedTotal: 700_000,
    savingsPendingTotal: 0,
    variable: { median: 0, low: 0, high: 0 },
    remainingDays: 10,
  })

  assert.equal(result.verdict, 'alcanza')
  assert.equal(result.spendable, 300_000)
  assert.equal(result.expected?.median, 300_000)
  assert.equal(result.dailyBudget, 30_000)
})

test('projectCycle no alcanza cuando el rango optimista es negativo', () => {
  const result = projectCycle({
    available: 500_000,
    incomeBefore: 0,
    fixedTotal: 800_000,
    savingsPendingTotal: 0,
    variable: { median: 0, low: 0, high: 0 },
    remainingDays: 10,
  })

  assert.equal(result.verdict, 'no_alcanza')
  assert.equal(result.expected?.median, -300_000)
})

test('projectCycle no alcanza con disponible negativo', () => {
  const result = projectCycle({
    available: -100_000,
    incomeBefore: 0,
    fixedTotal: 50_000,
    savingsPendingTotal: 0,
    variable: { median: 0, low: 0, high: 0 },
    remainingDays: 5,
  })

  assert.equal(result.verdict, 'no_alcanza')
  assert.equal(result.spendable, -150_000)
  assert.equal(result.dailyBudget, -30_000)
})

test('projectCycle queda ajustado cuando el rango cruza cero', () => {
  const result = projectCycle({
    available: 1_000_000,
    incomeBefore: 0,
    fixedTotal: 0,
    savingsPendingTotal: 0,
    variable: { median: 1_000_000, low: 800_000, high: 1_200_000 },
    remainingDays: AVG_DAYS_PER_MONTH,
  })

  assert.equal(result.verdict, 'ajustado')
  assert.equal(result.expected?.low, -200_000)
  assert.equal(result.expected?.high, 200_000)
})

test('projectCycle marca preliminar sin historial variable y sin base sin ingresos', () => {
  const preliminary = projectCycle({
    available: 300_000,
    incomeBefore: 0,
    fixedTotal: 100_000,
    savingsPendingTotal: 0,
    variable: null,
    remainingDays: 10,
  })
  assert.equal(preliminary.verdict, 'preliminar')
  assert.equal(preliminary.expected?.median, 200_000)
  assert.equal(preliminary.dailyBudget, 20_000)

  const noBase = projectCycle({
    available: null,
    incomeBefore: 0,
    fixedTotal: 100_000,
    savingsPendingTotal: 0,
    variable: null,
    remainingDays: 10,
  })
  assert.equal(noBase.verdict, 'sin_base')
  assert.equal(noBase.expected, null)
  assert.equal(noBase.dailyBudget, null)
})

test('dailyBudget nunca divide por cero', () => {
  assert.equal(dailyBudget(300_000, 10), 30_000)
  assert.equal(dailyBudget(300_000, 0), 300_000)
})
