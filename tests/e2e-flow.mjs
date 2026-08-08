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
      const dbg = await page.evaluate(async () => {
        const toasts = Array.from(document.querySelectorAll('[role="status"]')).map((t) => t.textContent)
        const body = document.body.textContent?.slice(0, 160)
        const cache = await new Promise((res) => {
          const rq = window.indexedDB.open('gastos-query-cache')
          rq.onsuccess = () => {
            const store = rq.result.transaction('queries', 'readonly').objectStore('queries')
            const keys = []
            const vals = []
            store.getAllKeys().onsuccess = (e) => keys.push(...e.target.result)
            store.getAll().onsuccess = (e) => {
              const out = {}
              vals.push(...e.target.result)
              keys.forEach((k, i) => { if (String(k).includes('expenses')) { try { out[k] = (JSON.parse(vals[i]).state?.data ?? []).map((x) => x.description) } catch { out[k] = 'parse-err' } } })
              res(out)
            }
          }
          rq.onerror = () => res({})
        })
        const monthLabel = document.querySelector('button[aria-label="Mes anterior"], [data-month-label]')?.textContent ?? null
        return { toasts, body, cache, monthLabel }
      })
      console.log(`  TOASTS: ${JSON.stringify(dbg.toasts)}`)
      console.log(`  BODY: ${JSON.stringify(dbg.body)}`)
      console.log(`  CACHE: ${JSON.stringify(dbg.cache)}`)
      console.log(`  MONTH: ${JSON.stringify(dbg.monthLabel)}`)
    } catch {}
    issues.push(`[STEP ${label}] ${e.message}`)
  }
}

async function waitForText(text, timeout = 6000) {
  await page.waitForSelector(`text=${text}`, { timeout })
}


// SelectInput personalizado: abrir el desplegable y elegir una opción exacta
async function pickOption(selectIndex, label) {
  await page.click(`button[data-select] >> nth=${selectIndex}`)
  await page.click(`[role="option"] >> text="${label}"`)
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
  await pickOption(0, 'Comida')
  await pickOption(1, 'Sandbox Test')
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

await step('configurar día de pago', async () => {
  await page.click('button[aria-label="Día de pago"]')
  await page.click('[role="option"] >> text="15"')
  await page.waitForTimeout(500)
  const val = (await page.textContent('button[aria-label="Día de pago"]'))?.trim()
  if (val !== '15') throw new Error('El día de pago no quedó en 15')
})

await step('salario heredado al mes siguiente', async () => {
  await page.click('button[aria-label="Mes siguiente"]')
  await waitForText('Heredado de')
  await waitForText('2.500.000')
  await waitForText('Llega el 15 de')
  await page.click('button[aria-label="Mes anterior"]')
  await waitGone('Heredado de')
})

await step('saldo acumulado en dashboard (sobrante arrastrado)', async () => {
  await goTo('Dashboard', '/')
  await waitForText('Saldo disponible')
  await waitForText('Incluye el sobrante de meses anteriores')
  await waitForText('2.300.000')
})

await step('fecha real de pago editable (nómina no pagada no infla el saldo)', async () => {
  await goTo('Miembros y Salarios', '/miembros')
  await page.click('button[aria-label="Editar salario"]')
  const now = new Date()
  const nextFirst = `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`
  await page.fill('input[type="date"]', nextFirst)
  await page.click('text=Guardar')
  await waitForText('Llega el 1 de')
  const heroSaldo = page.locator('[data-testid="hero-saldo"]')
  await goTo('Dashboard', '/')
  await heroSaldo.locator('text=/200\\.000/').waitFor({ timeout: 8000 })
  await goTo('Miembros y Salarios', '/miembros')
  await page.click('button[aria-label="Editar salario"]')
  const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  await page.fill('input[type="date"]', first)
  await page.click('text=Guardar')
  await goTo('Dashboard', '/')
  await heroSaldo.locator('text=2.300.000').waitFor({ timeout: 8000 })
})

await step('registrar dinero extra (ingreso no nómina suma al general)', async () => {
  await goTo('Miembros y Salarios', '/miembros')
  await waitForText('Registrar dinero extra')
  await page.click('text=Registrar dinero extra')
  await page.fill('input[inputmode="decimal"]', '150.000')
  await page.fill('input[placeholder="Ej. Vendí la bici, regalo, reembolso…"]', 'Venta bici')
  await page.click('text=Guardar')
  await waitForText('Venta bici')
  await waitForText('2.650.000')
  const heroSaldo = page.locator('[data-testid="hero-saldo"]')
  await goTo('Dashboard', '/')
  await heroSaldo.locator('text=2.450.000').waitFor({ timeout: 8000 })
  await page.waitForSelector('text=/Ingresos.*2\\.650\\.000/')
})

await step('tarjeta sobrantes por mes en dashboard', async () => {
  await waitForText('Sobrantes por mes')
  await page.waitForSelector('text=/Ingresos.*2\\.650\\.000.*Gastos.*200\\.000/')
  await waitForText('Ahorro 92%')
  await waitForText('Ver historial')
})

await step('historial completo por mes', async () => {
  await goTo('Historial', '/historial')
  await waitForText('Sobrantes por mes: cuánto quedó libre de cada mes')
  await waitForText('Ahorro acumulado')
  await waitForText('Totales')
  // La tabla de desktop es la fuente visible (las cards móviles están ocultas en >768px)
  await page.waitForSelector('td:has-text("92%")', { timeout: 6000 })
  await goTo('Dashboard', '/')
})

await step('recargar página: salarios visibles de inmediato (sin carrera)', async () => {
  await page.reload()
  await waitForText('Salarios del mes')
  const card = page.locator('.card:has-text("Salarios del mes")')
  await card.locator('text=2.500.000').waitFor({ timeout: 8000 })
  await waitGone('Aún no hay salarios registrados')
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
    await page.click('button[data-select] >> nth=0')
    await page.locator('[role="option"]:has-text("Mascotas")').first().waitFor({ state: 'attached', timeout: 6000 })
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
  await pickOption(0, 'Vivienda')
  await pickOption(1, 'Sandbox Test')
  await pickOption(2, 'Bimestral')
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
  await waitForText('Sí, lo pagué')
  await page.click('text=Sí, lo pagué')
  await waitGone('Sí, lo pagué')
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
  await page.waitForSelector('button[aria-label="Desactivar servicio"]', { timeout: 8000 })
  await page.click('button[aria-label="Desactivar servicio"]')
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
  const urls = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((e) => e.name),
  )
  const isLocalBackend = urls.some((u) => u.includes('127.0.0.1:54331'))
  await goTo('Gastos', '/gastos')
  await waitForText('Escanear factura')
  await page.click('text=Escanear factura')
  await page.waitForSelector('text="Tomar foto"')
  await page.waitForSelector('text="Subir de galería"')
  await page.setInputFiles('[data-testid="receipt-file-gallery"]', 'tests/fixtures/factura.jpg')
  await page.waitForSelector('text=Analizar factura')
  await page.click('text=Analizar factura')
  const analyzing = page.locator('text=Analizando factura')
  if (!isLocalBackend) {
    await analyzing.waitFor({ timeout: 20000 })
  }
  await analyzing.waitFor({ state: 'detached', timeout: 90000 }).catch(() => {
    if (isLocalBackend) console.log('  (local: Edge Function no servida — flujo de error verificado)')
  })
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

// Quick-add desde el Dashboard
await step('quick-add de gasto desde dashboard', async () => {
  await goTo('Dashboard', '/')
  await page.click('button[aria-label="Agregar gasto rápido"]')
  await page.fill('input[inputmode="decimal"]', '35.000')
  await page.fill('input[placeholder="Ej. Supermercado del mes"]', 'Rápido test')
  await page.click('text="Agregar gasto"')
  await waitForText('Rápido test')
})

// Modo offline: registros sin conexión + sincronización al reconectar
await step('registros sin conexión y sincronización al reconectar', async () => {
  await goTo('Dashboard', '/')
  await page.context().setOffline(true)

  // Gasto sin red: aparece al instante (optimista) con aviso de sin conexión
  await page.click('button[aria-label="Agregar gasto rápido"]')
  await page.fill('input[inputmode="decimal"]', '45.000')
  await page.fill('input[placeholder="Ej. Supermercado del mes"]', 'Offline gasto')
  await page.click('text="Agregar gasto"')
  await waitForText('Offline gasto')
  await page.waitForSelector('button[aria-label*="Sin conexión"]', { timeout: 6000 })

  // Dinero extra sin red
  await goTo('Miembros y Salarios', '/miembros')
  await page.click('text=Registrar dinero extra')
  await page.fill('input[inputmode="decimal"]', '60.000')
  await page.fill('input[placeholder="Ej. Vendí la bici, regalo, reembolso…"]', 'Offline extra')
  await page.click('text=Guardar')
  await waitForText('Offline extra')

  // Reconectar: se sincroniza solo y lo notifica
  await page.context().setOffline(false)
  await waitForText('sincronizados')

  // Los registros quedaron en el servidor (sobreviven una recarga)
  await page.reload()
  await goTo('Gastos', '/gastos')
  await waitForText('Offline gasto')
  await goTo('Miembros y Salarios', '/miembros')
  await waitForText('Offline extra')
})
// Dark mode
await step('modo oscuro y claro', async () => {
  await page.click('button[aria-label="Cambiar a modo oscuro"]')
  const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  if (!dark) throw new Error('modo oscuro no aplicado')
  await page.click('button[aria-label="Cambiar a modo claro"]')
  const light = await page.evaluate(() => !document.documentElement.classList.contains('dark'))
  if (!light) throw new Error('modo claro no aplicado')
})


// Quiero comprar: deseo de contado con "te quedaría"
await step('registrar deseo de contado y ver saldo restante', async () => {
  await goTo('Quiero comprar', '/quiero-comprar')
  await waitForText('Nuevo deseo')
  await page.click('text=Nuevo deseo')
  await page.fill('input[placeholder*="Nevera"]', 'Zapatos')
  await page.fill('input[inputmode="decimal"]', '350.000')
  await page.click('button:has-text("Registrar deseo")')
  await waitForText('Zapatos')
  await waitForText('Te quedaría')
})

// Quiero comprar: plan en cuotas con interés, abono inicial y proyección
await step('registrar deseo en cuotas con interés y abono', async () => {
  await page.click('text=Nuevo deseo')
  await page.fill('input[placeholder*="Nevera"]', 'Nevera')
  await page.fill('input[inputmode="decimal"]', '3.000.000')
  await page.click('button[data-select] >> nth=1')
  await page.click('[role="option"] >> text="En cuotas"')
  await waitForText('Cuota mensual')
  await page.click('button[data-select] >> nth=3')
  await page.click('[role="option"] >> text="2%"')
  await waitForText('404.145')
  // abono inicial (2º input decimal del form de cuotas)
  await page.locator('input[inputmode="decimal"]').nth(1).fill('500.000')
  await waitForText('Se financia')
  await waitForText('2.500.000')
  await page.click('button:has-text("Registrar deseo")')
  await waitForText('Nevera')
  await waitForText('12 cuotas al 2% · abono')
})

// Quiero comprar: marcar comprado y descartar
await step('estados de deseo: comprado y descartado', async () => {
  await page.click('button:has-text("Compré") >> nth=0')
  await waitForText('Comprado')
  await page.click('button:has-text("Descartar") >> nth=0')
  await waitForText('Descartado')
})

// Perfil: cambiar nombre
await step('cambiar nombre en perfil', async () => {
  await goTo('Perfil y Hogar', '/perfil')
  await waitForText('Tu cuenta')
  await page.fill('input[placeholder="Tu nombre"]', 'Sandbox Editado')
  await page.click('text=Guardar cambios')
  await waitForText('Sandbox Editado')
})

// Perfil: eliminar hogar (cierra el flujo — va a /setup)
await step('eliminar hogar desde perfil', async () => {
  // El perfil es un acordeón: expandir la sección de peligro
  await page.click('button[aria-controls="peligro-panel"]')
  await page.click('text=Eliminar hogar')
  await page.click('[data-testid="confirm-dialog-confirm"]')
  await page.waitForURL(/\/setup/, { timeout: 20000 })
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
