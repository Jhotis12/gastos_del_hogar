import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { formatMoneyInput, parseMoneyInput } from '@/lib/money'

interface MoneyInputProps {
  value: string
  onChange: (raw: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  required?: boolean
}

// Campo de monto en pesos colombianos: acepta "450.000", "2.500.000,50" o "450000".
// Formatea con puntos de miles en vivo (mientras se escriben solo dígitos),
// muestra prefijo "$" y usa dígitos tabulares. Al salir, normaliza el valor.
export default function MoneyInput({
  value,
  onChange,
  placeholder = '0.00',
  className,
  autoFocus,
  required,
}: MoneyInputProps) {
  const [text, setText] = useState(() => {
    const parsed = parseMoneyInput(value ?? '')
    return parsed !== null ? formatMoneyInput(parsed) : (value ?? '')
  })

  useEffect(() => {
    if (value !== text) setText(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const el = e.target
    setText(raw)
    onChange(raw)
    // Formato en vivo solo cuando el cursor está al final y el texto (sin
    // puntos de miles) son dígitos puros; así "2.500" + "0" -> "25.000"
    if (el.selectionStart === raw.length && el.selectionEnd === raw.length) {
      const stripped = raw.replace(/\./g, '')
      if (/^\d+$/.test(stripped)) {
        const formatted = formatMoneyInput(Number(stripped))
        if (formatted !== raw) {
          setText(formatted)
          onChange(formatted)
        }
      }
    }
  }

  const handleBlur = () => {
    const parsed = parseMoneyInput(text)
    if (parsed !== null) {
      const formatted = formatMoneyInput(parsed)
      setText(formatted)
      onChange(formatted)
    }
  }

  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-ink/40">
        $
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="done"
        required={required}
        autoFocus={autoFocus}
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-surface py-3 pl-8 pr-4 text-base tabular-nums text-ink placeholder:text-ink/35 focus:border-pine-500 focus:outline-none focus:ring-2 focus:ring-pine-500/20"
      />
    </div>
  )
}
