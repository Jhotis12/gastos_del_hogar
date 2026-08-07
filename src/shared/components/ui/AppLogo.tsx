interface AppLogoProps {
  size?: number
  className?: string
}

export default function AppLogo({ size = 40, className }: AppLogoProps) {
  return (
    <img
      src="/icono.svg"
      alt="Gastos del Hogar"
      width={size}
      height={size}
      className={className}
    />
  )
}
