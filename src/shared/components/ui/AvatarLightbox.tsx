import { useEffect } from 'react'
import { X } from 'lucide-react'

// Visor de foto de perfil a pantalla completa. Fondo oscuro, cierra con
// Escape, clic en el fondo o en la X.
export default function AvatarLightbox({
  src,
  name,
  onClose,
}: {
  src: string | null
  name?: string | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!src) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [src, onClose])

  if (!src) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Foto de perfil"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar foto"
        className="absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X size={20} />
      </button>
      <img
        src={src}
        alt={name ? `Foto de ${name}` : 'Foto de perfil'}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85dvh] max-w-full rounded-2xl object-contain shadow-2xl"
      />
    </div>
  )
}
