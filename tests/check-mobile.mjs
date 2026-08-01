import { firefox } from 'playwright'
const browser = await firefox.launch()
const page = await browser.newPage({ viewport: { width: 375, height: 812 } })
const issues = []
await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' })
await page.fill('input[type="email"]', 'sandbox-test@test.com')
await page.fill('input[type="password"]', 'Sandbox123!')
await page.click('button[type="submit"]')
await page.waitForTimeout(6000)
if (page.url().includes('/setup')) {
  await page.fill('input[placeholder="Ej. Casa de la familia"]', 'Hogar Sandbox')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(5000)
}
for (const [label, url] of [['gastos', '/gastos'], ['servicios', '/recurrentes'], ['ahorros', '/ahorros'], ['perfil', '/perfil']]) {
  await page.goto(`http://localhost:5173${url}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const info = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
  }))
  if (info.overflow) issues.push(`${label}: overflow ${info.sw} > ${info.iw}`)
  console.log(`${label}: ${info.overflow ? '⚠ OVERFLOW' : 'ok'} (${info.sw}px)`)
}
console.log(issues.length ? 'ISSUES: ' + issues.join(' | ') : 'SIN OVERFLOW HORIZONTAL ✓')
await browser.close()
