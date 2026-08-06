// Suite e2e MÓVIL (375px con touch real): cubre las interacciones táctiles
// que el e2e de escritorio no prueba — bottom sheets, arrastre para cerrar
// (desde el asa, no desde el cuerpo), flick, dropdowns, acordeón y "Más".
// Requiere: dev server arriba y sandbox reseteado (tests/reset-sandbox.sh).
import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const EMAIL = 'sandbox-test@test.com'
const PASS = 'Sandbox123!'

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true })
const page = await context.newPage()
const issues = []

let failed = 0
async function step(label, fn) {
  try {
    await fn()
    console.log(`PASS: ${label}`)
  } catch (e) {
    failed++
    console.log(`FAIL: ${label} -> ${String(e.message).split('\n')[0]}`)
  }
}

async function waitForText(text, timeout = 8000) {
  await page.waitForSelector(`text=${text}`, { timeout })
}

// Gesto táctil sobre el asa (la "rallita"): dispara touchstart/move/end
async function swipeHandle(delta, opts = {}) {
  await page.evaluate(async ({ delta, steps, stepMs, flick }) => {
    const handles = document.querySelectorAll('.h-1.w-10')
    const el = handles[handles.length - 1]
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const y0 = rect.top + 2
    const touch = (type, y) => el.dispatchEvent(new TouchEvent(type, {
      bubbles: true, cancelable: true,
      touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target: el, clientX: cx, clientY: y })],
      changedTouches: [new Touch({ identifier: 1, target: el, clientX: cx, clientY: y })],
    }))
    touch('touchstart', y0)
    if (flick) {
      for (let i = 1; i <= 3; i++) {
        await new Promise((r) => setTimeout(r, 10))
        touch('touchmove', y0 + (delta / 3) * i)
      }
    } else {
      for (let i = 1; i <= steps; i++) {
        await new Promise((r) => setTimeout(r, stepMs))
        touch('touchmove', y0 + (delta / steps) * i)
      }
    }
    touch('touchend', y0 + delta)
  }, { delta, steps: opts.steps ?? 4, stepMs: opts.stepMs ?? 60, flick: opts.flick ?? false })
}

const modalAbierto = () => page.evaluate(() => !!document.querySelector('[role="dialog"]'))
// Overlays a pantalla completa (backdrop de modales) detectados por clase:
// Tailwind v4 compila bg-black/50 con color-mix (oklab), no rgba.
const overlayCount = () =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('div')).filter(
      (d) =>
        d.className.includes('bg-black/50') &&
        getComputedStyle(d).position === 'fixed' &&
        d.getBoundingClientRect().height > innerHeight * 0.9,
    ).length,
  )

// ---------- FLUJO ----------
await step('login móvil', async () => {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForTimeout(5000)
  if (page.url().includes('/setup')) {
    await page.fill('input[placeholder="Ej. Casa de la familia"]', 'Hogar Sandbox')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(5000)
  }
})

await step('FAB abre action-sheet y el formulario como bottom sheet', async () => {
  await page.goto(`${BASE}/gastos`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.click('button[aria-label="Agregar gasto"]')
  await page.waitForTimeout(400)
  await page.locator('div.rounded-t-3xl button', { hasText: 'Nuevo gasto' }).click()
  await page.waitForTimeout(600)
  if (!(await modalAbierto())) throw new Error('el formulario no abrió')
  await page.fill('input[inputmode="decimal"]', '15.000')
})

await step('dropdown de categoría: abrir, elegir y arrastrar su asa cierra solo el dropdown', async () => {
  await page.click('button[data-select] >> nth=0')
  await page.waitForTimeout(500)
  const listbox = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="listbox"]')).some((l) => l.offsetParent !== null))
  if (!listbox) throw new Error('el dropdown no abrió')
  // arrastrar el asa del dropdown → cierra el dropdown, el modal sigue
  await swipeHandle(100, { flick: true })
  await page.waitForTimeout(500)
  const estado = await page.evaluate(() => ({
    dropdown: !Array.from(document.querySelectorAll('[role="listbox"]')).some((l) => l.offsetParent !== null),
    modal: !!document.querySelector('[role="dialog"]'),
  }))
  estado.overlay = await overlayCount()
  if (!estado.dropdown || !estado.modal) throw new Error(`dropdown=${estado.dropdown} modal=${estado.modal}`)
  if (estado.overlay !== 1) throw new Error(`overlay inesperado: ${estado.overlay}`)
  // elegir una categoría ahora
  await page.click('button[data-select] >> nth=0')
  await page.waitForTimeout(400)
  await page.click('[role="option"] >> text="Sin categoría"')
  await page.waitForTimeout(300)
})

await step('arrastrar desde el CUERPO no cierra el modal (sigue abierto y sin pantalla negra)', async () => {
  await page.evaluate(async () => {
    const panel = document.querySelector('[role="dialog"] .overflow-y-auto')
    const rect = panel.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const y0 = rect.top + 120
    const touch = (type, y) => panel.dispatchEvent(new TouchEvent(type, {
      bubbles: true, cancelable: true,
      touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target: panel, clientX: cx, clientY: y })],
      changedTouches: [new Touch({ identifier: 1, target: panel, clientX: cx, clientY: y })],
    }))
    touch('touchstart', y0)
    for (let i = 1; i <= 4; i++) { await new Promise((r) => setTimeout(r, 50)); touch('touchmove', y0 + 30 * i) }
    touch('touchend', y0 + 120)
    await new Promise((r) => setTimeout(r, 500))
  })
  const estado = { modal: await page.evaluate(() => !!document.querySelector('[role="dialog"]')) }
  estado.overlay = await overlayCount()
  if (!estado.modal) throw new Error('el cuerpo cerró el modal')
  if (estado.overlay !== 1) throw new Error(`overlay inesperado: ${estado.overlay}`)
})

await step('flick con formulario con cambios: abre el diálogo de descarte y al confirmar no queda nada', async () => {
  await swipeHandle(90, { flick: true })
  await page.waitForTimeout(700)
  const estado = await page.evaluate(() => ({
    dialogs: document.querySelectorAll('[role="dialog"]').length,
    descarte: document.body.textContent?.includes('Descartar cambios') ?? false,
  }))
  if (estado.dialogs !== 2 || !estado.descarte) {
    throw new Error(`esperaba diálogo de descarte: dialogs=${estado.dialogs} descarte=${estado.descarte}`)
  }
  // confirmar descarte → todo cierra, sin overlay negro atrapado
  await page.click('[data-testid="confirm-dialog-confirm"]')
  await page.waitForTimeout(700)
  const final = {
    modal: await page.evaluate(() => !!document.querySelector('[role="dialog"]')),
  }
  final.overlay = await overlayCount()
  if (final.modal || final.overlay > 0) throw new Error(`pantalla negra tras descartar: modal=${final.modal} overlay=${final.overlay}`)
})

await step('flick en formulario limpio: cierra directo sin overlay negro', async () => {
  await page.click('button[aria-label="Agregar gasto"]')
  await page.waitForTimeout(300)
  await page.locator('div.rounded-t-3xl button', { hasText: 'Nuevo gasto' }).click()
  await page.waitForTimeout(600)
  await swipeHandle(90, { flick: true })
  await page.waitForTimeout(700)
  const final = {
    modal: await page.evaluate(() => !!document.querySelector('[role="dialog"]')),
  }
  final.overlay = await overlayCount()
  if (final.modal) throw new Error('el flick no cerró el modal limpio')
  if (final.overlay > 0) throw new Error(`pantalla negra: ${final.overlay} overlay(s) atrapados`)
})

await step('arrastre lento y corto NO cierra (rebota) y sin overlay atrapado', async () => {
  await page.click('button[aria-label="Agregar gasto"]')
  await page.waitForTimeout(300)
  await page.locator('div.rounded-t-3xl button', { hasText: 'Nuevo gasto' }).click()
  await page.waitForTimeout(600)
  await swipeHandle(40, { steps: 4, stepMs: 80 })
  await page.waitForTimeout(600)
  const estado = { modal: await page.evaluate(() => !!document.querySelector('[role="dialog"]')) }
  estado.overlay = await overlayCount()
  if (!estado.modal) throw new Error('el arrastre corto cerró el modal')
  if (estado.overlay !== 1) throw new Error(`overlay inesperado: ${estado.overlay}`)
  // cerrar con X
  await page.click('button[aria-label="Cerrar"]')
  await page.waitForTimeout(600)
  const final = { modal: await page.evaluate(() => !!document.querySelector('[role="dialog"]')) }
  final.overlay = await overlayCount()
  if (final.modal || final.overlay > 0) throw new Error(`tras cerrar con X: modal=${final.modal} overlay=${final.overlay}`)
})

await step('acordeón de ajustes: varias secciones abiertas a la vez', async () => {
  await page.goto(`${BASE}/perfil`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.click('button[aria-controls="apariencia-panel"]')
  await page.click('button[aria-controls="hogar-panel"]')
  await page.waitForTimeout(500)
  const expandidos = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button[aria-controls]')).filter((b) => b.getAttribute('aria-expanded') === 'true').length)
  if (expandidos !== 3) throw new Error(`secciones abiertas: ${expandidos} (esperaba 3)`)
  // toggle de animaciones funciona
  await page.click('button[role="switch"][aria-label="Reducir animaciones"]')
  await page.waitForTimeout(300)
  const clase = await page.evaluate(() => document.documentElement.classList.contains('reduce-animations'))
  if (!clase) throw new Error('el toggle de animaciones no aplicó')
  await page.click('button[role="switch"][aria-label="Reducir animaciones"]')
})

await step('sheet "Más": se abre y se cierra arrastrando el asa', async () => {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.click('button[aria-label="Más opciones"]')
  await page.waitForTimeout(500)
  const abierto = await page.evaluate(() => document.body.textContent?.includes('Cerrar sesión'))
  if (!abierto) throw new Error('el sheet "Más" no abrió')
  await swipeHandle(90, { flick: true })
  await page.waitForTimeout(700)
  const cerrado = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Más opciones"]')
    return btn?.getAttribute('aria-expanded') === 'false'
  })
  if (!cerrado) throw new Error('el sheet "Más" no cerró con el asa')
  const overlay = await overlayCount()
  if (overlay > 0) throw new Error(`pantalla negra en "Más": ${overlay} overlay(s)`)
})

console.log(`\n===== RESUMEN MÓVIL =====`)
console.log(failed === 0 ? 'TODOS LOS PASOS PASARON' : `${failed} paso(s) fallaron`)
if (issues.length) console.log('ISSUES:', issues.join(' | '))
await browser.close()
process.exit(failed ? 1 : 0)
