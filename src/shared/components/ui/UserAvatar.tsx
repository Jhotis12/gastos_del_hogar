import { useEffect, useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { cn } from '@/shared/lib/utils'

// Avatar circular: foto de perfil si existe (bucket público 'avatars'),
// si no, inicial del nombre con gradiente pine. Tamaños de miniatura a
// protagonista (xs → xl).
const SIZES = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-20 w-20 text-2xl sm:h-24 sm:w-24',
} as const

interface UserAvatarProps {
  name?: string | null
  avatarPath?: string | null
  size?: keyof typeof SIZES
  className?: string
  onClick?: () => void
}

export default function UserAvatar({
  name,
  avatarPath,
  size = 'md',
  className,
  onClick,
}: UserAvatarProps) {
  const src = avatarPath
    ? supabase.storage.from('avatars').getPublicUrl(avatarPath).data.publicUrl
    : null
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name ? `Foto de ${name}` : 'Foto de perfil'}
        loading="lazy"
        onClick={onClick}
        onError={() => setFailed(true)}
        className={cn(
          'shrink-0 rounded-full object-cover ring-1 ring-ink/10',
          onClick && 'cursor-pointer transition-transform hover:scale-105 active:scale-95',
          SIZES[size],
          className,
        )}
      />
    )
  }

  const initial = (name?.trim().charAt(0) ?? '?').toUpperCase()
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br from-pine-600 to-pine-800 font-semibold text-white ring-1 ring-ink/10',
        SIZES[size],
        className,
      )}
    >
      {initial}
    </span>
  )
}
