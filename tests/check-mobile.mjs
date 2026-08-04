// Auditoría mobile: overflow horizontal a 375px en todas las rutas y en los
// modales/formularios clave (bottom-sheets). Requiere dev server arriba y
// sandbox listo (tests/reset-sandbox.sh).
import { firefox } from 'playwright'

const BASE = 'http://localhost:5173'
const browser = await firefox.launch()
const page = await browser.newPage({ viewport: { width: 375, height: 812 } })
const issues = []

async function checkOverflow(label) {
  await page.waitForTimeout(800)
  const info = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
  }))
  if (info.overflow) issues.push(`${label}: overflow ${info.sw} > ${info.iw}`)
  console.log(`${label}: ${info.overflow ? '⚠ OVERFLOW' : 'ok'} (${info.sw}px)`)
}

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.fill('input[type="email"]', 'sandbox-test@test.com')
await page.fill('input[type="password"]', 'Sandbox123!')
await page.click('button[type="submit"]')
await page.waitForTimeout(6000)
if (page.url().includes('/setup')) {
  await page.fill('input[placeholder="Ej. Casa de la familia"]', 'Hogar Sandbox')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(5000)
}

// Todas las rutas de la app
for (const [label, url] of [
  ['dashboard', '/'],
  ['gastos', '/gastos'],
  ['calendario', '/calendario'],
  ['servicios', '/recurrentes'],
  ['ahorros', '/ahorros'],
  ['categorias', '/categorias'],
  ['miembros', '/miembros'],
  ['historial', '/historial'],
  ['perfil', '/perfil'],
]) {
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
  await checkOverflow(label)
}

// FAB + action-sheet de Gastos
await page.goto(`${BASE}/gastos`, { waitUntil: 'domcontentloaded' })
await page.click('button[aria-label="Agregar gasto"]')
await checkOverflow('sheet gastos (action-sheet FAB)')
await page.locator('div.rounded-t-3xl button', { hasText: 'Nuevo gasto' }).click()
await checkOverflow('modal nuevo gasto (bottom-sheet)')
await page.click('button[aria-label="Cerrar"]')

// Formularios vía bottom-sheet
await page.goto(`${BASE}/recurrentes`, { waitUntil: 'domcontentloaded' })
await page.click('button[aria-label="Cerrar"], text=Nuevo servicio').catch(() => {})
await page.click('text=Nuevo servicio')
await checkOverflow('modal nuevo servicio')
await page.click('button[aria-label="Cerrar"]')

await page.goto(`${BASE}/ahorros`, { waitUntil: 'domcontentloaded' })
await page.click('text=Nueva meta')
await checkOverflow('modal nueva meta')
await page.click('button[aria-label="Cerrar"]')

await page.goto(`${BASE}/categorias`, { waitUntil: 'domcontentloaded' })
await page.click('text=Nueva categoría')
await checkOverflow('modal nueva categoria')
await page.click('button[aria-label="Cerrar"]')

// Sheet "Más"
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
await page.click('button[aria-label="Más opciones"]')
await checkOverflow('sheet más opciones')
await page.keyboard.press('Escape')

// Calendario: celda del día + modal
await page.goto(`${BASE}/calendario`, { waitUntil: 'domcontentloaded' })
await page.click('[data-testid^="day-"]')
await checkOverflow('modal día del calendario')
await page.click('button[aria-label="Cerrar"]')

console.log(issues.length ? 'ISSUES: ' + issues.join(' | ') : 'SIN OVERFLOW HORIZONTAL ✓')
await browser.close()
process.exit(issues.length ? 1 : 0)
