import { firefox } from 'playwright'

const BASE = 'http://localhost:5173'
const EMAIL = 'sandbox-test@test.com'
const PASS = 'Sandbox123!'

const browser = await firefox.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
page.on('pageerror', (e) => console.log('[PAGEERROR]', e.message))

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.screenshot({ path: '/tmp/opencode/design-login.png' })
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', PASS)
await page.click('button[type="submit"]')
await page.waitForURL((u) => u.pathname !== '/login', { timeout: 20000 })
if (page.url().includes('/setup')) {
  await page.fill('input[placeholder="Ej. Casa de la familia"]', 'Hogar Sandbox')
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => u.pathname === '/', { timeout: 20000 })
}
await page.waitForTimeout(2500)
await page.screenshot({ path: '/tmp/opencode/design-dashboard.png' })

await page.click('nav >> text=Servicios')
await page.waitForURL(/\/recurrentes/, { timeout: 10000 })
await page.waitForTimeout(2000)
await page.screenshot({ path: '/tmp/opencode/design-servicios.png' })

await page.click('nav >> text=Gastos')
await page.waitForURL(/\/gastos/, { timeout: 10000 })
await page.waitForTimeout(2000)
await page.screenshot({ path: '/tmp/opencode/design-gastos.png' })

await page.click('nav >> text=Calendario')
await page.waitForURL(/\/calendario/, { timeout: 10000 })
await page.waitForTimeout(2000)
await page.screenshot({ path: '/tmp/opencode/design-calendario.png' })

await browser.close()
console.log('capturas listas')
