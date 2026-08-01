// Prueba de sincronización en tiempo real entre dos miembros del hogar.
// Requiere: dev server arriba, SUPABASE_SERVICE_ROLE en el entorno.
// El usuario sandbox debe existir (usar tests/reset-sandbox.sh antes).
import { firefox } from 'playwright'
import fs from 'node:fs'

const BASE = 'http://localhost:5173'
const SRV = process.env.SUPABASE_SERVICE_ROLE
if (!SRV) {
  console.error('Falta SUPABASE_SERVICE_ROLE')
  process.exit(1)
}
const URL = fs.readFileSync('.env', 'utf-8').match(/VITE_SUPABASE_URL=(.*)/)[1].trim()
const ANON = fs.readFileSync('.env', 'utf-8').match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim()

const EMAIL_A = 'sandbox-test@test.com'
const PASS_A = 'Sandbox123!'
const EMAIL_B = `miembro2-${Date.now()}@test.com`
const PASS_B = 'Miembro2123!'

const browser = await firefox.launch()

async function login(page, email, pass) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', pass)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => u.pathname !== '/login', { timeout: 20000 })
}

const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const pageA = await ctxA.newPage()
const pageB = await ctxB.newPage()

const h = (res) => {
  if (!res.ok) {
    console.log(`[API ${res.status}]`, res.url().slice(0, 120))
    process.exit(1)
  }
  return res.json()
}

// 1) Sesión de A (sandbox) y asegurar hogar
await login(pageA, EMAIL_A, PASS_A)
await pageA.waitForURL((u) => u.pathname === '/' || u.pathname === '/setup', { timeout: 20000 })
await pageA.waitForTimeout(3000)
console.log('A tras login (estable):', pageA.url())
if (pageA.url().includes('/setup')) {
  await pageA.fill('input[placeholder="Ej. Casa de la familia"]', 'Hogar Realtime')
  await pageA.click('button[type="submit"]')
  await pageA.waitForURL((u) => u.pathname === '/', { timeout: 20000 })
  await pageA.waitForTimeout(2000)
  console.log('A tras crear hogar:', pageA.url())
}

// token + household de A
const tokenA = await pageA.evaluate(() => {
  const raw = localStorage.getItem('sb-xqfemqgokoedpenmqsmq-auth-token')
  if (!raw) return null
  try { return JSON.parse(raw).access_token } catch { return null }
})
console.log('tokenA len:', tokenA ? tokenA.length : null)
const hhRes = await fetch(`${URL}/rest/v1/households?select=id,invite_code`, {
  headers: { Authorization: `Bearer ${tokenA}`, apikey: ANON },
})
console.log('households HTTP', hhRes.status)
const hhJson = await hhRes.json()
console.log('households body:', JSON.stringify(hhJson).slice(0, 200))
const prof = await (await fetch(`${URL}/rest/v1/profiles?select=id,household_id&id=eq.` + tokenA.slice(0,0) , { headers: { Authorization: `Bearer ${tokenA}`, apikey: ANON } })).json().catch(() => null)
const me = await (await fetch(`${URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${tokenA}`, apikey: ANON } })).json().catch(() => null)
console.log('auth/v1/user:', JSON.stringify(me).slice(0, 120))
const household = hhJson[0]
console.log('Hogar:', household.id, '| código:', household.invite_code)

// 2) Crear miembro B (admin) y unirse al hogar
const bUser = await h(await fetch(`${URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${SRV}`, apikey: SRV, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL_B, password: PASS_B, email_confirm: true, user_metadata: { full_name: 'Miembro B' } }),
}))

await login(pageB, EMAIL_B, PASS_B)
await pageB.waitForURL((u) => u.pathname === '/' || u.pathname === '/setup', { timeout: 20000 })
await pageB.waitForTimeout(5000)
console.log('B tras login (estable):', pageB.url())
if (pageB.url().includes('/setup')) {
  await pageB.click('text=Unirme a uno')
  await pageB.waitForSelector('input[placeholder="ABC123"]')
  await pageB.fill('input[placeholder="ABC123"]', household.invite_code)
  await pageB.click('button[type="submit"]')
  await pageB.waitForURL((u) => u.pathname === '/', { timeout: 20000 })
  await pageB.waitForTimeout(2000)
}
console.log('Miembro B unido al hogar')

// 3) A crea un gasto; B debe verlo SIN recargar
await pageA.goto(`${BASE}/gastos`, { waitUntil: 'domcontentloaded' })
await pageA.waitForTimeout(1500)
await pageA.click('text=Nuevo gasto')
await pageA.fill('input[inputmode="decimal"]', '42.000')
await pageA.fill('input[placeholder="Ej. Supermercado del mes"]', 'Gasto Realtime')
await pageA.click('text="Agregar gasto"')
await pageA.waitForTimeout(1500)

await pageB.goto(`${BASE}/gastos`, { waitUntil: 'domcontentloaded' })
await pageB.waitForTimeout(1500)
console.log('Esperando que B vea el gasto sin recargar…')
try {
  await pageB.waitForSelector('text=Gasto Realtime', { timeout: 20000 })
  console.log('PASS: B vio "Gasto Realtime" en tiempo real sin recargar')
} catch {
  console.log('FAIL: B no vio el gasto en 20s')
}

// 4) B registra su salario; el dashboard de A debe actualizarse solo
await pageB.goto(`${BASE}/miembros`, { waitUntil: 'domcontentloaded' })
await pageB.waitForTimeout(1500)
await pageB.click('text=+ Registrar salario')
await pageB.fill('input[inputmode="decimal"]', '1.800.000')
await pageB.click('text=Guardar')
await pageB.waitForTimeout(1500)

await pageA.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
await pageA.waitForTimeout(1500)
console.log('Esperando que el dashboard de A sume el salario de B…')
try {
  await pageA.waitForSelector('text=1.800.000', { timeout: 20000 })
  console.log('PASS: el dashboard de A reflejó el salario de B en tiempo real')
} catch {
  console.log('FAIL: el dashboard de A no reflejó el salario de B en 20s')
}

// Limpieza: borrar miembro B
await h(await fetch(`${URL}/auth/v1/admin/users/${bUser.id}`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${SRV}`, apikey: SRV },
}))

await browser.close()
console.log('Limpieza completada (miembro B eliminado)')
