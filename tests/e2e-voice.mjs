import { firefox } from 'playwright'

// Captura por voz con la Edge Function mockeada (no se llama a Gemini real).
// Requiere VITE_FEATURE_VOICE_EXPENSE=true y el usuario sandbox.
const BASE = 'http://localhost:5173'
const EMAIL = 'sandbox-test@test.com'
const PASS = 'Sandbox123!'
const DRAFT = {
  draft: {
    amount: 50000,
    description: 'Mercado de voz',
    date: null,
    category_hint: 'Comida',
    payer_hint: 'yo',
    confidence: 0.92,
  },
}

let failed = 0
const step = async (label, fn) => {
  try {
    await fn()
    console.log(`PASS: ${label}`)
  } catch (error) {
    failed++
    console.log(`FAIL: ${label} -> ${String(error.message).split('\n')[0]}`)
  }
}

const browser = await firefox.launch({
  firefoxUserPrefs: {
    'media.navigator.streams.fake': true,
    'media.navigator.permission.disabled': true,
  },
})
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const issues = []
page.on('pageerror', (error) => issues.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') issues.push(message.text())
})
await page.route('**/functions/v1/analyze-expense-audio', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(DRAFT),
  }),
)

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', PASS)
await page.click('button[type="submit"]')
await page.waitForURL((url) => url.pathname !== '/login', { timeout: 20000 })
await page.waitForTimeout(1500)

if (page.url().includes('/setup')) {
  await page.fill('input[placeholder="Ej. Casa de la familia"]', 'Hogar Voz')
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => url.pathname === '/', { timeout: 20000 })
  await page.waitForTimeout(1200)
}

await page.goto(`${BASE}/gastos`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

await step('la bandera muestra el botón de dictar', async () => {
  await page.getByRole('button', { name: 'Nuevo gasto' }).first().click()
  await page.getByRole('button', { name: 'Dictar gasto' }).waitFor({ timeout: 8000 })
})

await step('consentimiento y grabación simulada', async () => {
  await page.getByRole('button', { name: 'Dictar gasto' }).click()
  await page.getByRole('button', { name: 'Aceptar y grabar' }).click()
  await page.getByRole('button', { name: 'Empezar a grabar' }).click()
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: 'Detener y analizar' }).click()
  await page.getByText('Borrador de voz listo').waitFor({ timeout: 10000 })
})

await step('el borrador llena el formulario', async () => {
  const description = await page.locator('#expense-description').inputValue()
  const amount = await page.locator('input[aria-label="Monto"]').first().inputValue()
  if (description !== 'Mercado de voz') throw new Error(`descripción: ${description}`)
  if (!amount.includes('50.000')) throw new Error(`monto: ${amount}`)
})

await step('confirmar crea un solo gasto', async () => {
  await page.getByRole('button', { name: 'Agregar gasto' }).last().click()
  await page.getByText('Gasto registrado').waitFor({ timeout: 8000 })
  await page.waitForTimeout(1200)
  const count = await page.getByText('Mercado de voz').count()
  if (count !== 1) throw new Error(`filas encontradas: ${count}`)
})

await browser.close()
if (issues.length > 0) {
  console.log(`ISSUES: ${JSON.stringify(issues.slice(0, 5))}`)
  failed++
}
console.log(failed === 0 ? 'VOZ OK' : `VOZ FALLÓ (${failed})`)
process.exit(failed === 0 ? 0 : 1)
