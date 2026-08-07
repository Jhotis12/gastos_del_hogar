import { useCallback, useEffect, useRef, useState } from 'react'

export type Theme = 'light' | 'dark'

function initialTheme(): Theme {
  const saved = localStorage.getItem('theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const SWITCH_MS = 400

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  // El tema ya se aplicó antes del primer render (main.tsx): la primera
  // ejecución del efecto no debe activar la transición de cambio.
  const firstRun = useRef(true)

  useEffect(() => {
    const root = document.documentElement
    if (!firstRun.current) {
      root.classList.add('theme-switching')
    }
    root.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)

    const t = setTimeout(() => root.classList.remove('theme-switching'), SWITCH_MS)
    return () => {
      clearTimeout(t)
      root.classList.remove('theme-switching')
    }
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  useEffect(() => {
    firstRun.current = false
  }, [])

  return { theme, toggle }
}
