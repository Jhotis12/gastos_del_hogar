import { firefox } from 'playwright'

const BASE = 'http://localhost:5173'
const EMAIL = 'sandbox-test@test.com'
const PASS = 'Sandbox123!'

const issues = []
const browser = await firefox.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
page.setDefaultTimeout(10000)
page.on('console', (message) => {
  const text = message.text()
  if (text.includes('[timeStamp]')) return
  if (message.type() === 'error' || message.type() === 'warning') {
    issues.push(`[console:${message.type()}] ${text}`)
  }
})
page.on('pageerror', (error) => issues.push(`[PAGEERROR] ${error.message}`))

let failed = 0
async function step(label, fn) {
  try {
    await fn()
    console.log(`PASS: ${label}`)
  } catch (error) {
    failed++
    console.log(`FAIL: ${label} -> ${String(error.message).split('\n')[0]}`)
    try {
      console.log(`  URL: ${page.url()}`)
      console.log(
        `  BODY: ${JSON.stringify((await page.locator('body').innerText()).slice(0, 240))}`,
      )
    } catch {}
    issues.push(`[STEP ${label}] ${error.message}`)
  }
}

async function goTo(navText, pathname) {
  await page.keyboard.press('Escape').catch(() => {})
  await page.click(`nav >> text=${navText}`)
  await page.waitForURL((url) => url.pathname === pathname, { timeout: 10000 })
  await page.waitForTimeout(350)
}

async function openExpenseForm() {
  await page.getByRole('button', { name: 'Nuevo gasto' }).first().click()
  await page.locator('#expense-description').waitFor()
}

async function fillExpense({ amount, description }) {
  await page.locator('#expense-description').fill(description)
  await page.locator('[role="dialog"] input[aria-label="Monto"]').fill(amount)
}

async function submitExpense() {
  await page.locator('[role="dialog"] button[type="submit"]').click()
}

// ---------- flujo ----------
await step('login', async () => {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => url.pathname !== '/login', { timeout: 15000 })
})

await step('crear hogar', async () => {
  await page.waitForTimeout(1200)
  if (page.url().includes('/setup')) {
    await page.fill('input[placeholder="Ej. Casa de la familia"]', 'Hogar Sandbox')
    await page.click('button[type="submit"]')
  }
  await page.waitForURL((url) => url.pathname === '/', { timeout: 15000 })
  await page.getByText('Hogar Sandbox').first().waitFor()
})

await step('Inicio personal: hero Mi mes / Mi pago / Mi ahorro / Hogar', async () => {
  await page.getByTestId('hero-saldo').waitFor()
  await page.getByTestId('hero-hogar').waitFor()
  for (const text of ['Mi mes', 'Desde mi último pago', 'Mi ahorro', 'Hogar']) {
    await page.getByText(text, { exact: false }).first().waitFor()
  }
})

await step('registrar salario', async () => {
  await goTo('Miembros e ingresos', '/miembros')
  await page.getByText('+ Registrar salario').first().click()
  await page.locator('[role="dialog"] input[aria-label="Monto del salario"], input[aria-label="Monto del salario"]').first().fill('2.500.000')
  await page.getByRole('button', { name: 'Guardar', exact: true }).first().click()
  await page.getByText('2.500.000').first().waitFor()
})

await step('crear gasto con pagador por defecto', async () => {
  await goTo('Gastos', '/gastos')
  await openExpenseForm()
  const payer = await page.locator('[role="dialog"] button[data-select]').last().textContent()
  if (!payer || payer.includes('Selecciona')) throw new Error(`pagador por defecto: ${payer}`)
  await fillExpense({ amount: '50.000', description: 'Mercado e2e' })
  await submitExpense()
  await page.getByText('Gasto registrado').waitFor()
})

await step('editar gasto', async () => {
  const row = page.locator('li', { hasText: 'Mercado e2e' }).first()
  await row.getByRole('button', { name: 'Editar' }).click()
  await page.locator('[role="dialog"] input[aria-label="Monto"]').fill('60.000')
  await submitExpense()
  await page.getByText('Gasto actualizado').waitFor()
})

await step('Inicio refleja Mi mes y la lista personal', async () => {
  await goTo('Inicio', '/')
  await page.getByText('Mercado e2e').first().waitFor()
  const body = await page.locator('body').innerText()
  if (!body.includes('60.000')) throw new Error('Mi mes no refleja el gasto')
})

await step('Gastos: tabs Hogar / Mis gastos y ventanas', async () => {
  await goTo('Gastos', '/gastos')
  await page.getByRole('tab', { name: 'Mis gastos' }).click()
  await page.getByRole('button', { name: 'Desde mi último pago' }).click()
  await page.getByText(/^Total filtrado ·/).waitFor()
  await page.getByRole('tab', { name: 'Hogar' }).click()
  await page.getByText(/^Total del mes filtrado ·/).waitFor()
})

await step('Historial: Hogar / Mis meses', async () => {
  await goTo('Historial', '/historial')
  await page.getByRole('tab', { name: 'Mis meses' }).click()
  await page.getByRole('tab', { name: 'Hogar' }).click()
  await page.getByRole('columnheader', { name: 'Ingresos' }).waitFor()
})

await step('Ahorro personal con depósito inicial y retiro', async () => {
  await goTo('Ahorros', '/ahorros')
  await page.getByRole('button', { name: 'Nueva meta' }).first().click()
  await page.locator('input[placeholder="Ej. Viaje de fin de año"]').fill('Meta E2E')
  await page.getByLabel('Monto objetivo').fill('500000')
  await page.getByLabel('Depósito inicial').fill('100000')
  await page.getByRole('button', { name: 'Crear meta' }).click()
  await page.getByText('Meta creada').waitFor()
  await page.getByRole('tab', { name: 'Mis metas' }).click()
  const card = page.locator('.card', { hasText: 'Meta E2E' }).first()
  await card.getByRole('button', { name: 'Depositar' }).click()
  await page.getByLabel('Monto a depositar').fill('50000')
  await page.getByRole('button', { name: 'Confirmar depósito' }).click()
  await page.getByText('Depósito registrado').waitFor()
  await card.getByRole('button', { name: 'Retirar' }).click()
  await page.getByLabel('Monto a retirar').fill('50000')
  await page.getByRole('button', { name: 'Confirmar retiro' }).click()
  await page.getByText('Retiro registrado').waitFor()
})

await step('autoahorro y archivo de la meta', async () => {
  const card = page.locator('.card', { hasText: 'Meta E2E' }).first()
  await card.getByRole('button', { name: 'Autoahorro' }).click()
  await page.getByLabel('Monto mensual').fill('20000')
  await page.getByRole('button', { name: 'Guardar autoahorro' }).click()
  await page.getByText('Autoahorro configurado').waitFor()
  await page.locator('.card', { hasText: 'Meta E2E' }).first().getByRole('button', { name: 'Archivar meta' }).click()
  await page.getByRole('button', { name: 'Archivar', exact: true }).click()
  await page.getByRole('button', { name: /Ver archivadas/ }).click()
  await page.getByText('Meta E2E').first().waitFor()
})

await step('gasto offline y sincronización', async () => {
  await goTo('Gastos', '/gastos')
  await page.context().setOffline(true)
  await page.waitForTimeout(300)
  await openExpenseForm()
  await fillExpense({ amount: '30000', description: 'Offline e2e' })
  await submitExpense()
  await page.getByText('Guardado sin conexión').waitFor()
  const offlineRow = page.locator('li', { hasText: 'Offline e2e' }).first()
  await offlineRow.waitFor()
  const offlineText = await offlineRow.innerText()
  if (!offlineText.includes('Sandbox Test')) {
    throw new Error(`la fila offline no conserva el pagador: ${offlineText}`)
  }
  await page.context().setOffline(false)
  await page.waitForTimeout(1200)
  const pendingButton = page.getByRole('button', { name: /pendiente/i })
  if (await pendingButton.count()) await pendingButton.first().click()
  await page.getByText('Offline e2e').first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(2000)
  const pendingAfter = await page.getByRole('button', { name: /pendiente/i }).count()
  if (pendingAfter > 0) throw new Error('quedaron cambios pendientes de sincronizar')
})

await step('modo oscuro y claro', async () => {
  await page.getByRole('button', { name: /modo oscuro/i }).click()
  await page.waitForTimeout(400)
  const isDark = await page.evaluate(() =>
    document.documentElement.classList.contains('dark'),
  )
  if (!isDark) throw new Error('no se activó el modo oscuro')
  await page.getByRole('button', { name: /modo claro/i }).click()
})

await browser.close()

if (issues.length > 0) {
  console.log(`ISSUES (${issues.length}):`)
  for (const issue of issues.slice(0, 10)) console.log(`  ${issue}`)
  failed++
}
console.log(failed === 0 ? 'TODOS LOS PASOS PASARON' : `FALLARON ${failed} PASOS`)
process.exit(failed === 0 ? 0 : 1)
