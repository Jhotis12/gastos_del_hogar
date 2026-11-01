import { firefox } from 'playwright'

const BASE = 'http://localhost:5173'
const API = process.env.SUPABASE_URL || 'http://127.0.0.1:54331'
const SERVICE = process.env.SUPABASE_SERVICE_ROLE
const EMAIL = 'sandbox-test@test.com'
const PASS = 'Sandbox123!'
const B_EMAIL = `sandbox-b-${Date.now()}@test.com`

if (!SERVICE) {
  console.error('Falta SUPABASE_SERVICE_ROLE')
  process.exit(1)
}

const api = async (path, options = {}) => {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers ?? {}),
    },
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${response.status} ${path}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

const currentMonth = new Date()
const thisMonth = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01`
const prev = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`
const prevLastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0).getDate()
const payDate = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`
const todayDay = currentMonth.getDate()
const safeDay = (day) => `${thisMonth.slice(0, 8)}${String(Math.min(day, todayDay)).padStart(2, '0')}`

let failed = 0
const step = async (label, fn) => {
  try {
    await fn()
    console.log(`PASS: ${label}`)
  } catch (error) {
    failed++
    console.log(`FAIL: ${label} -> ${String(error.message).split('\n')[0]}`)
    try {
      console.log(`  BODY: ${JSON.stringify((await page.locator('body').innerText()).slice(0, 400))}`)
    } catch {}
  }
}

const browser = await firefox.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } })
page.setDefaultTimeout(12000)
page.on('pageerror', (error) => console.log('PAGEERROR', error.message))

let bUserId = null
let householdId = null

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', PASS)
await page.click('button[type="submit"]')
await page.waitForURL((url) => url.pathname !== '/login', { timeout: 15000 })
await page.waitForTimeout(1200)
if (page.url().includes('/setup')) {
  await page.fill('input[placeholder="Ej. Casa de la familia"]', 'Hogar Dinero')
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => url.pathname === '/', { timeout: 15000 })
}

const users = await api('/auth/v1/admin/users')
const aUser = users.users.find((user) => user.email === EMAIL)
if (!aUser) throw new Error('No se encontró el usuario sandbox')
const [aProfile] = await api(`/rest/v1/profiles?id=eq.${aUser.id}&select=id,household_id`)
householdId = aProfile.household_id
if (!householdId) throw new Error('El sandbox no tiene hogar')

// Segundo miembro con otro día de pago.
const bUser = await api('/auth/v1/admin/users', {
  method: 'POST',
  body: JSON.stringify({
    email: B_EMAIL,
    password: PASS,
    email_confirm: true,
    user_metadata: { full_name: 'Sandbox B' },
  }),
})
bUserId = bUser.id
await page.waitForTimeout(500)
await api(`/rest/v1/profiles?id=eq.${bUserId}`, {
  method: 'PATCH',
  body: JSON.stringify({ household_id: householdId, payday: 15 }),
})
await api(`/rest/v1/profiles?id=eq.${aUser.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ payday: 30 }),
})

// Datos del ledger: salario atrasado de A, salario de B, gastos de ambos y legado.
await api('/rest/v1/salaries', {
  method: 'POST',
  body: JSON.stringify([
    {
      household_id: householdId,
      profile_id: aUser.id,
      amount: 3000000,
      month: prevMonth,
      pay_date: payDate,
    },
    {
      household_id: householdId,
      profile_id: bUserId,
      amount: 2000000,
      month: thisMonth,
      pay_date: `${thisMonth.slice(0, 8)}01`,
    },
  ]),
})
await api('/rest/v1/incomes', {
  method: 'POST',
  body: JSON.stringify([
    {
      household_id: householdId,
      member_id: aUser.id,
      amount: 500000,
      description: 'Extra A',
      income_date: safeDay(5),
    },
    {
      household_id: householdId,
      member_id: null,
      amount: 100000,
      description: 'Extra hogar',
      income_date: safeDay(6),
    },
  ]),
})
await api('/rest/v1/expenses', {
  method: 'POST',
  body: JSON.stringify([
    {
      household_id: householdId,
      paid_by: aUser.id,
      amount: 1200000,
      description: 'Gasto A e2e-money',
      expense_date: safeDay(10),
    },
    {
      household_id: householdId,
      paid_by: bUserId,
      amount: 300000,
      description: 'Gasto B e2e-money',
      expense_date: safeDay(11),
    },
    {
      household_id: householdId,
      paid_by: null,
      amount: 50000,
      description: 'Gasto legado e2e-money',
      expense_date: safeDay(12),
    },
  ]),
})

await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

await step('disponible personal = ingresos - gastos desde el pago', async () => {
  const hero = await page.getByTestId('hero-saldo').innerText()
  if (!hero.includes('2.300.000')) throw new Error(`hero: ${hero}`)
})

await step('Mis gastos excluye el gasto pagado por B', async () => {
  const recent = await page
    .locator('section', { hasText: 'Mis gastos recientes' })
    .innerText()
  if (!recent.includes('Gasto A e2e-money')) {
    throw new Error('no aparece el gasto de A')
  }
  if (recent.includes('Gasto B e2e-money')) {
    throw new Error('el gasto de B se filtró a Mis gastos')
  }
})

await step('Hogar reconcilia A + B + Sin asignar', async () => {
  const home = await page.locator('section', { hasText: 'Hogar' }).last().innerText()
  for (const expected of ['1.550.000', '1.200.000', '300.000', '50.000']) {
    if (!home.includes(expected)) throw new Error(`falta ${expected}: ${home.slice(0, 300)}`)
  }
})

await step('dos miembros con días de pago distintos', async () => {
  await page.click('nav >> text=Miembros e ingresos')
  await page.waitForURL((url) => url.pathname === '/miembros', { timeout: 10000 })
  await page.waitForTimeout(1000)
  const body = await page.locator('body').innerText()
  if (!body.includes('día 15') || !body.includes('Sandbox B')) {
    throw new Error('no se ve el día de pago del segundo miembro')
  }
})

await step('crear meta personal con depósito inicial', async () => {
  await page.click('nav >> text=Ahorros')
  await page.waitForURL((url) => url.pathname === '/ahorros', { timeout: 10000 })
  await page.getByRole('button', { name: 'Nueva meta' }).first().click()
  await page.locator('input[placeholder="Ej. Viaje de fin de año"]').fill('Meta dinero')
  await page.getByLabel('Monto objetivo').fill('1000000')
  await page.getByLabel('Depósito inicial').fill('100000')
  await page.getByRole('button', { name: 'Crear meta' }).click()
  await page.getByText('Meta creada').waitFor()
  await page.getByRole('tab', { name: 'Mis metas' }).click()
  await page.getByText('Meta dinero').first().waitFor()
})

await step('el ahorro manual descuenta el disponible', async () => {
  await page.click('nav >> text=Inicio')
  await page.waitForURL((url) => url.pathname === '/', { timeout: 10000 })
  await page.waitForTimeout(1800)
  const hero = await page.getByTestId('hero-saldo').innerText()
  if (!hero.includes('2.200.000')) throw new Error(`hero tras depósito: ${hero}`)
})

await step('autoahorro descuenta el disponible y no duplica', async () => {
  await page.click('nav >> text=Ahorros')
  await page.waitForURL((url) => url.pathname === '/ahorros', { timeout: 10000 })
  await page.getByRole('tab', { name: 'Mis metas' }).click()
  const card = page.locator('.card', { hasText: 'Meta dinero' }).first()
  await card.getByRole('button', { name: 'Autoahorro' }).click()
  await page.getByLabel('Monto mensual').fill('50000')
  await page.getByRole('button', { name: 'Guardar autoahorro' }).click()
  await page.getByText('Autoahorro configurado').waitFor()
  // Simula la reconexión: Layout ejecuta run_due_savings al evento online.
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await page.waitForTimeout(4000)
  await page.click('nav >> text=Inicio')
  await page.waitForTimeout(1800)
  const hero = await page.getByTestId('hero-saldo').innerText()
  if (!hero.includes('2.150.000')) throw new Error(`hero tras autoahorro: ${hero}`)

  const [goal] = await api(`/rest/v1/savings_goals?name=eq.${encodeURIComponent('Meta dinero')}&select=id`)
  const movements = await api(
    `/rest/v1/savings_movements?goal_id=eq.${goal.id}&kind=eq.auto&select=id`,
  )
  if (movements.length !== 1) throw new Error(`movimientos auto: ${movements.length}`)
})

await browser.close()
if (bUserId) {
  await api(`/auth/v1/admin/users/${bUserId}`, { method: 'DELETE' })
}
console.log(failed === 0 ? 'DINERO OK' : `DINERO FALLÓ (${failed})`)
process.exit(failed === 0 ? 0 : 1)
