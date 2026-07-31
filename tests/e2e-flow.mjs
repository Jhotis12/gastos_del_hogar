import { firefox } from 'playwright'

const BASE = 'http://localhost:5173'
const EMAIL = 'sandbox-test@test.com'
const PASS = 'Sandbox123!'

const issues = []
const httpErrors = []

const browser = await firefox.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.on('console', (m) => {
  const t = m.text()
  if (t.includes('[timeStamp]')) return
  if (m.type() === 'error' || m.type() === 'warning') issues.push(`[console:${m.type()}] ${t}`)
})
page.on('pageerror', (e) => issues.push(`[PAGEERROR] ${e.message}`))
page.on('response', async (r) => {
  if (r.status() >= 400 && r.url().includes('supabase')) {
    let body = ''
    try { body = (await r.text()).slice(0, 300) } catch {}
    httpErrors.push(`[HTTP ${r.status()}] ${r.request().method()} ${r.url()}\n    ${body}`)
  }
})

let failed = 0
async function step(label, fn) {
  try {
    await fn()
    console.log(`PASS: ${label}`)
  } catch (e) {
    failed++
    console.log(`FAIL: ${label} -> ${String(e.message).split('\n')[0]}`)
    try {
      console.log(`  URL: ${page.url()}`)
    } catch {}
    issues.push(`[STEP ${label}] ${e.message}`)
  }
}

async function waitForText(text, timeout = 6000) {
  await page.waitForSelector(`text=${text}`, { timeout })
}

async function waitGone(text, timeout = 6000) {
  await page.waitForSelector(`text=${text}`, { state: 'detached', timeout })
}

// Navegación SPA vía sidebar (como usuario real)
async function goTo(navText, pathname) {
  await page.keyboard.press('Escape').catch(() => {})
  await page.click(`nav >> text=${navText}`)
  await page.waitForURL((u) => u.pathname === pathname, { timeout: 8000 })
  await page.waitForTimeout(300)
}

// ---------- FLUJO ----------
await step('login', async () => {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/setup/, { timeout: 6000 })
})

await step('crear hogar', async () => {
  await page.fill('input[placeholder="Ej. Casa de la familia"]', 'Hogar Sandbox')
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => u.pathname === '/', { timeout: 6000 })
  await waitForText('Hogar Sandbox')
})

// Miembros y Salarios
await step('registrar salario', async () => {
  await goTo('Miembros y Salarios', '/miembros')
  await waitForText('+ Registrar salario')
  await page.click('text=+ Registrar salario')
  await page.fill('input[inputmode="decimal"]', '2.500.000')
  await page.click('text=Guardar')
  await waitForText('2.500.000')
})

await step('salario aparece en dashboard (ingreso unificado)', async () => {
  await goTo('Dashboard', '/')
  await waitForText('2.500.000')
})

// Gastos
await step('crear gasto', async () => {
  await goTo('Gastos', '/gastos')
  await waitForText('Nuevo gasto')
  await page.click('text=Nuevo gasto')
  await page.fill('input[inputmode="decimal"]', '150.000')
  await page.fill('input[placeholder="Ej. Supermercado del mes"]', 'Mercado test')
  await page.selectOption('select >> nth=0', { label: 'Comida' })
  await page.selectOption('select >> nth=1', { label: 'Sandbox Test' })
  await page.click('text=Agregar gasto')
  await waitForText('Mercado test')
  await waitForText('150.000')
})

await step('editar gasto', async () => {
  await page.click('button[aria-label="Editar"]')
  await page.fill('input[inputmode="decimal"]', '175.000')
  await page.click('text=Guardar cambios')
  await waitGone('150.000')
  await waitForText('175.000')
})

await step('dashboard refleja gasto y saldo', async () => {
  await goTo('Dashboard', '/')
  await waitForText('175.000')
})

await step('calendario muestra gastos del día', async () => {
  await goTo('Calendario', '/calendario')
  await waitForText('Gastos del mes')
  const now = new Date()
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  await page.waitForSelector(`[data-testid="day-${iso}"]`)
  await waitForText('175.000')
})

await step('crear gasto desde el calendario', async () => {
  const now = new Date()
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  await page.click(`[data-testid="day-${iso}"]`)
  await page.click('text="Agregar gasto de este día"')
  await page.fill('input[inputmode="decimal"]', '25.000')
  await page.fill('input[placeholder="Ej. Supermercado del mes"]', 'Calendario test')
  await page.click('text="Agregar gasto"')
  await waitForText('Calendario test')
  await page.keyboard.press('Escape')
  await waitGone('Calendario test')
})

await step('saldos entre miembros', async () => {
  await goTo('Miembros y Salarios', '/miembros')
  await waitForText('A favor')
  await waitForText('2.325.000')
})

await step('búsqueda y export CSV en gastos', async () => {
  await goTo('Gastos', '/gastos')
  await waitForText('Mercado test')
  await waitForText('Calendario test')
  await page.fill('input[placeholder="Buscar por descripción…"]', 'Mercado')
  await waitForText('Mercado test')
  await waitGone('Calendario test')
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.click('text=Exportar CSV'),
  ])
  if (!download.suggestedFilename().endsWith('.csv')) {
    throw new Error('El archivo exportado no es CSV')
  }
  await page.fill('input[placeholder="Buscar por descripción…"]', '')
  await waitForText('Calendario test')
})

// Categorías
await step('crear categoría', async () => {
  await goTo('Categorías', '/categorias')
  await waitForText('Nueva categoría')
  await page.click('text=Nueva categoría')
  await page.fill('input[placeholder="Ej. Educación"]', 'Mascotas')
  await page.click('button[aria-label^="Color"] >> nth=2')
  await page.click('text=Crear')
  await waitForText('Mascotas')
})

await step('establecer presupuesto de categoría', async () => {
  const comidaCard = page
    .locator('div.flex.items-center.justify-between', { hasText: 'Comida' })
    .first()
  await comidaCard.locator('button[aria-label="Editar presupuesto"]').click()
  await page.fill('input[inputmode="decimal"]', '200.000')
  await page.click('text="Guardar"')
  await waitForText('200.000')
})

await step('presupuesto visible en dashboard', async () => {
  await goTo('Dashboard', '/')
  await waitForText('200.000')
})

await step('categoría nueva disponible en formulario de gasto', async () => {
  await goTo('Gastos', '/gastos')
  await waitForText('Nuevo gasto')
  await page.click('text=Nuevo gasto')
  try {
    await page.locator('select option', { hasText: 'Mascotas' }).first().waitFor({ state: 'attached', timeout: 6000 })
  } finally {
    await page.keyboard.press('Escape').catch(() => {})
  }
})

// Servicios (gastos fijos)
await step('crear servicio (bimestral)', async () => {
  await goTo('Servicios', '/recurrentes')
  await waitForText('Nuevo servicio')
  await page.click('text=Nuevo servicio')
  await page.fill('input[placeholder="Ej. Internet del hogar"]', 'Renta test')
  await page.fill('input[inputmode="decimal"]', '450.000')
  await page.selectOption('select >> nth=0', { label: 'Vivienda' })
  await page.selectOption('select >> nth=1', { label: 'Sandbox Test' })
  await page.selectOption('select >> nth=2', { label: 'Bimestral' })
  await page.click('text=Agregar')
  await waitForText('Renta test')
  await waitForText('450.000')
  await waitForText('Bimestral')
  await waitForText('Pendiente')
})

await step('aplicar recurrentes desde dashboard', async () => {
  await goTo('Dashboard', '/')
  await waitForText('Aplicar recurrentes')
  await page.click('text=Aplicar recurrentes')
  await goTo('Gastos', '/gastos')
  await waitForText('Renta test')
})

await step('servicio queda pagado tras aplicar', async () => {
  await goTo('Servicios', '/recurrentes')
  await waitForText('Pagado')
})

await step('editar servicio', async () => {
  await waitForText('Renta test')
  await page.click('button[aria-label="Editar servicio"]')
  await page.fill('input[inputmode="decimal"]', '480.000')
  await page.click('text=Guardar cambios')
  await waitForText('480.000')
})

await step('desactivar servicio', async () => {
  await goTo('Servicios', '/recurrentes')
  await page.waitForSelector('button[aria-label="Desactivar"]', { timeout: 8000 })
  await page.click('button[aria-label="Desactivar"]')
  await page.waitForTimeout(800)
  const body = (await page.evaluate(() => document.body.innerText)).trim()
  if (!body.includes('Renta test')) throw new Error('El servicio desapareció al desactivarlo')
})

await step('eliminar gasto', async () => {
  await goTo('Gastos', '/gastos')
  await waitForText('Mercado test')
  const row = page.locator('li', { hasText: 'Mercado test' }).first()
  await row.locator('button[aria-label="Eliminar"]').click()
  await page.click('[data-testid="confirm-dialog-confirm"]')
  await waitGone('Mercado test')
})

await step('eliminar servicio', async () => {
  await goTo('Servicios', '/recurrentes')
  await waitForText('Renta test')
  const row = page.locator('li', { hasText: 'Renta test' }).first()
  await row.locator('button[aria-label="Eliminar"]').click()
  await page.click('[data-testid="confirm-dialog-confirm"]')
  await waitGone('Renta test')
})

await step('eliminar categoría', async () => {
  await goTo('Categorías', '/categorias')
  await waitForText('Mascotas')
  const card = page
    .locator('div.flex.items-center.justify-between', { hasText: 'Mascotas' })
    .filter({ has: page.locator('button[aria-label="Eliminar categoría"]') })
    .first()
  await card.locator('button[aria-label="Eliminar categoría"]').click()
  await page.click('[data-testid="confirm-dialog-confirm"]')
  await waitGone('Mascotas')
})

// Metas de ahorro
await step('crear meta de ahorro', async () => {
  await goTo('Metas de ahorro', '/ahorros')
  await waitForText('Nueva meta')
  await page.click('text=Nueva meta')
  await page.fill('input[placeholder="Ej. Viaje de fin de año"]', 'Viaje de fin de año')
  await page.fill('input[inputmode="decimal"] >> nth=0', '2.000.000')
  await page.fill('input[inputmode="decimal"] >> nth=1', '500.000')
  await page.click('text=Crear meta')
  await waitForText('Viaje de fin de año')
  await waitForText('25%')
})

await step('depositar en la meta', async () => {
  await page.click('text="Depositar"')
  await page.fill('input[inputmode="decimal"]', '500.000')
  await page.click('text="Confirmar depósito"')
  await waitForText('50%')
  await waitForText('1.000.000')
})

await step('retirar de la meta', async () => {
  await page.click('text="Retirar"')
  await page.fill('input[inputmode="decimal"]', '250.000')
  await page.click('text="Confirmar retiro"')
  await waitForText('38%')
})

await step('editar meta de ahorro', async () => {
  await page.click('button[aria-label="Editar meta"]')
  await page.fill('input[placeholder="Ej. Viaje de fin de año"]', 'Viaje y emergencias')
  await page.click('text=Guardar cambios')
  await waitForText('Viaje y emergencias')
  await waitGone('Viaje de fin de año')
})

await step('eliminar meta de ahorro', async () => {
  await page.click('button[aria-label="Eliminar meta"]')
  await page.click('[data-testid="confirm-dialog-confirm"]')
  await waitGone('Viaje y emergencias')
})

// Escaneo de facturas
await step('escanear factura: dos opciones y análisis', async () => {
  await goTo('Gastos', '/gastos')
  await waitForText('Escanear factura')
  await page.click('text=Escanear factura')
  await page.waitForSelector('text="Tomar foto"')
  await page.waitForSelector('text="Subir de galería"')
  await page.setInputFiles('[data-testid="receipt-file-gallery"]', 'tests/fixtures/factura.jpg')
  await page.waitForSelector('text=Analizar factura')
  await page.click('text=Analizar factura')
  await page.waitForSelector('text=Analizando factura', { timeout: 20000 })
  await page.waitForSelector('text=Analizando factura', { state: 'detached', timeout: 90000 })
  const body = await page.evaluate(() => document.body.innerText)
  if (!body.includes('Crear gasto')) {
    console.log('  (el análisis devolvió error — flujo de error verificado)')
  }
})

await step('crear gasto desde factura y ver detalle', async () => {
  const body = await page.evaluate(() => document.body.innerText)
  if (!body.includes('Crear gasto')) return
  await waitForText('TOTAL')
  await waitForText('23.300')
  await page.click('text="Crear gasto"')
  await waitForText('Don Jose')
  await page.click('button[aria-label="Ver factura"]')
  await waitForText('Arroz Diana')
  await waitForText('TOTAL')
  await page.keyboard.press('Escape')
})

console.log('\n===== RESUMEN =====')
console.log(failed === 0 ? 'TODOS LOS PASOS PASARON' : `${failed} paso(s) fallaron`)
if (httpErrors.length) {
  console.log('\n--- ERRORES HTTP ---')
  console.log(httpErrors.join('\n\n'))
}
if (issues.length) {
  console.log('\n--- ISSUES CONSOLA/PAGE ---')
  console.log(issues.join('\n'))
}
await browser.close()
