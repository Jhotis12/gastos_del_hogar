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
// Al salir del campo, formatea el valor con puntos de miles.
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

  const handleBlur = () => {
    const parsed = parseMoneyInput(text)
    if (parsed !== null) {
      const formatted = formatMoneyInput(parsed)
      setText(formatted)
      onChange(formatted)
    }
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      required={required}
      autoFocus={autoFocus}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={cn(
        'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-pine-500 focus:outline-none',
        className,
      )}
    />
  )
}
