import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scrollLock'
import { useDragToClose } from '@/hooks/useDragToClose'
import { cn } from '@/lib/utils'

interface SelectInputProps {
  value: string | number
  onChange: (e: { target: { value: string } }) => void
  children: ReactNode
  className?: string
  'aria-label'?: string
  disabled?: boolean
}

interface OptionElement {
  props: { value?: unknown; children?: ReactNode }
}

const isOption = (c: ReactNode): c is ReactElement<OptionElement['props']> =>
  isValidElement(c) && c.type === 'option'

// Desplegable personalizado (sustituye al <select> nativo, que se ve mal en
// móvil): bottom-sheet en pantallas pequeñas y dropdown anclado desde sm+.
// Todos los colores usan tokens (bg-surface, text-ink, hover:bg-cream…), así
// que respeta el modo oscuro automáticamente.
export default function SelectInput({
  value,
  onChange,
  children,
  className,
  'aria-label': ariaLabel,
  disabled,
}: SelectInputProps) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const options = Children.toArray(children).filter(isOption)
  const current =
    options.find((o) => String(o.props.value) === String(value)) ?? options[0]
  const label = current ? String(current.props.children ?? '') : ''

  const openMenu = () => {
    if (disabled) return
    setRect(triggerRef.current?.getBoundingClientRect() ?? null)
    setIsMobile(window.matchMedia('(max-width: 639px)').matches)
    setOpen(true)
  }
  const closeMenu = () => setOpen(false)
  const drag = useDragToClose(closeMenu)
  const requestClose = drag.requestClose

  const select = (optionValue: unknown) => {
    onChange({ target: { value: String(optionValue) } })
    requestClose()
  }

  // Escape + cierre al redimensionar (el rect quedaría desfasado)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', closeMenu)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', closeMenu)
    }
  }, [open])

  // Scroll-lock del fondo solo cuando el sheet móvil está abierto
  useEffect(() => {
    if (!open || !isMobile) return
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [open, isMobile])

  const renderOption = (o: (typeof options)[number]) => {
    const optionValue = String(o.props.value ?? '')
    const optionLabel = String(o.props.children ?? '')
    const selected = optionValue === String(value)
    return (
      <li key={optionValue} role="option" aria-selected={selected}>
        <button
          type="button"
          onClick={() => select(optionValue)}
          className={cn(
            'flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
            selected
              ? 'bg-pine-50 font-medium text-pine-600'
              : 'text-ink/75 hover:bg-cream',
          )}
        >
          <span className="truncate">{optionLabel}</span>
          {selected && <Check size={16} className="shrink-0 text-pine-600" />}
        </button>
      </li>
    )
  }

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        data-select="true"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? requestClose() : openMenu())}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-surface px-4 py-3 text-base text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-pine-500/20 disabled:opacity-50',
          open && 'border-pine-500',
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown
          size={16}
          className={cn(
            'shrink-0 text-ink/40 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      {open &&
        createPortal(
          <>
            {/* Clic fuera */}
            <div className="fixed inset-0 z-[59]" onClick={closeMenu} />
            {isMobile ? (
              /* Bottom-sheet (móvil) */
              <div className="fixed inset-0 z-[60]">
                <div
                  ref={drag.panelRef}
                  style={drag.style}
                  className={cn(
                    'animate-sheet-up absolute inset-x-0 bottom-0 max-h-[70dvh] overflow-y-auto overscroll-contain rounded-t-3xl bg-surface p-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl',
                    !drag.dragging && !drag.closing && 'transition-transform duration-300 ease-out',
                  )}
                >
                  <div
                    {...drag.handleProps}
                    className="mx-auto mb-2 h-1 w-10 shrink-0 touch-none rounded-full bg-ink/10"
                  />
                  <ul role="listbox" aria-label={ariaLabel}>
                    {options.map(renderOption)}
                  </ul>
                </div>
              </div>
            ) : (
              /* Dropdown anclado (desktop) */
              rect && (
                <div
                  style={{
                    position: 'fixed',
                    top: rect.bottom + 6,
                    left: rect.left,
                    width: rect.width,
                    zIndex: 60,
                  }}
                >
                  <ul
                    role="listbox"
                    aria-label={ariaLabel}
                    className="animate-scale-in max-h-[280px] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-surface p-1.5 shadow-xl"
                  >
                    {options.map(renderOption)}
                  </ul>
                </div>
              )
            )}
          </>,
          document.body,
        )}
    </div>
  )
}
