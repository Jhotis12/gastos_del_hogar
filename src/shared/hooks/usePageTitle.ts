import { useEffect } from 'react'

// Título del documento por página: ayuda a navegar con pestañas y a
// lectores de pantalla. Se restaura al desmontar.
export function usePageTitle(title: string) {
  useEffect(() => {
    const prev = document.title
    document.title = title ? `${title} · Gastos del Hogar` : 'Gastos del Hogar'
    return () => {
      document.title = prev
    }
  }, [title])
}
