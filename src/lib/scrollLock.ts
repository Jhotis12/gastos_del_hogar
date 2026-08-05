// Bloqueo de scroll del fondo COMPARTIDO entre modales y sheets (móvil).
// Un contador evita el bug de los modales anidados: si cada uno capturara y
// restaurara su propio valor de overflow, el último en cerrarse restauraría
// un valor viejo ('hidden') y el fondo quedaría bloqueado para siempre.
let locks = 0
let scrollbarPad = false

export function lockBodyScroll(): void {
  if (locks === 0) {
    document.body.style.overflow = 'hidden'
    if (window.innerWidth > document.documentElement.clientWidth) {
      document.body.style.paddingRight = '15px'
      scrollbarPad = true
    }
  }
  locks++
}

export function unlockBodyScroll(): void {
  locks = Math.max(0, locks - 1)
  if (locks === 0) {
    document.body.style.overflow = ''
    if (scrollbarPad) {
      document.body.style.paddingRight = ''
      scrollbarPad = false
    }
  }
}
