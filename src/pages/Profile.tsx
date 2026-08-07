import { useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  Check,
  Copy,
  Home,
  Info,
  Loader2,
  LogOut,
  Palette,
  RefreshCw,
  Settings,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { PALETTES } from '@/lib/palettes'
import { useHousehold } from '@/hooks/useHousehold'
import { useMembers } from '@/hooks/useMembers'
import {
  useDeleteHousehold,
  useLeaveHousehold,
  useRemoveAvatar,
  useUpdateAvatar,
  useUpdateProfile,
} from '@/hooks/useMembers'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import PageSkeleton from '@/components/ui/PageSkeleton'
import Toggle from '@/components/ui/Toggle'
import UserAvatar from '@/components/ui/UserAvatar'
import { useToast } from '@/components/ui/Toast'
import AppLogo from '@/components/ui/AppLogo'
import { cn, errorMessage } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-surface px-4 py-3 text-base text-ink placeholder:text-ink/35 focus:border-pine-500 focus:outline-none focus:ring-2 focus:ring-pine-500/20'

// Sección tipo acordeón: el encabezado es un botón que despliega/contenido
// colapsado con animación suave (grid-rows) y fuera del tabulador al cerrar.
function AccordionSection({
  id,
  icon,
  title,
  description,
  open,
  onToggle,
  className,
  children,
}: {
  id: string
  icon: ReactNode
  title: string
  description?: string
  open: boolean
  onToggle: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('card animate-fade-up overflow-hidden', className)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className="flex w-full items-center gap-3 p-5 text-left transition-colors hover:bg-cream/60"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pine-50 text-pine-600">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm font-semibold text-ink">{title}</span>
          {description && <span className="block text-xs text-ink/40">{description}</span>}
        </span>
        <ChevronDown
          size={18}
          className={cn(
            'shrink-0 text-ink/40 transition-transform duration-300',
            open && 'rotate-180',
          )}
        />
      </button>
      <div
        id={`${id}-panel`}
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div inert={!open} className="min-h-0 overflow-hidden">
          <div className="px-5 pb-5 pt-1">{children}</div>
        </div>
      </div>
    </div>
  )
}

// Fila de ajuste con switch (tema, animaciones…)
function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {description && <p className="mt-0.5 text-xs text-ink/40">{description}</p>}
      </div>
      {children}
    </div>
  )
}

export default function Profile() {
  usePageTitle('Perfil')
  const { user, profile, signOut } = useAuth()
  const { reduceAnimations, toggleReduceAnimations, palette, applyPalette } = useSettings()
  const { data: household } = useHousehold()
  const { data: members } = useMembers()
  const updateProfile = useUpdateProfile()
  const leaveHousehold = useLeaveHousehold()
  const deleteHousehold = useDeleteHousehold()
  const toast = useToast()

  const [name, setName] = useState(profile?.full_name ?? '')
  const [copied, setCopied] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  // Acordeón: varias secciones abiertas a la vez (Tu cuenta por defecto)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['cuenta']))
  const toggleSection = (id: string) =>
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const isOpen = (id: string) => openSections.has(id)
  const updateAvatar = useUpdateAvatar()
  const removeAvatar = useRemoveAvatar()
  const avatarInputRef = useRef<HTMLInputElement>(null)

  if (!profile) return <PageSkeleton />

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    try {
      await updateProfile.mutateAsync({ full_name: name.trim() })
      toast.success('Nombre actualizado')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona una imagen (JPG, PNG o WebP)')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('La imagen pesa más de 10 MB')
      return
    }
    try {
      await updateAvatar.mutateAsync({ file })
      toast.success('Foto de perfil actualizada')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const handleRemoveAvatar = async () => {
    try {
      await removeAvatar.mutateAsync()
      toast.success('Foto de perfil eliminada')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const copyCode = async () => {
    if (!household) return
    await navigator.clipboard.writeText(household.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Buscar actualizaciones manualmente: re-descarga el service worker; si
  // hay un build nuevo, UpdatePrompt muestra el aviso con el botón Actualizar.
  const checkForUpdates = async () => {
    if (checkingUpdate) return
    setCheckingUpdate(true)
    try {
      if (!('serviceWorker' in navigator)) {
        toast.info('Busca actualizaciones desde la app instalada (PWA)')
        return
      }
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg) {
        toast.info('Busca actualizaciones desde la app instalada (PWA)')
        return
      }
      // Si ya hay una versión esperando activarse (el aviso ya apareció al
      // cargar), no decir que está al día.
      if (reg.waiting) {
        toast.info('Ya hay una actualización pendiente — pulsa Actualizar en el aviso')
        return
      }
      const updated = await new Promise<boolean>((resolve) => {
        let done = false
        const finish = (found: boolean) => {
          if (done) return
          done = true
          resolve(found)
        }
        reg.addEventListener('updatefound', () => finish(true))
        void reg.update().catch(() => finish(false))
        setTimeout(() => finish(false), 4000)
      })
      if (!updated) toast.info('Ya tienes la última versión')
      // si updated: el banner de UpdatePrompt aparece solo
    } finally {
      setCheckingUpdate(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Cabecera */}
      <div className="animate-fade-up flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pine-600 to-pine-800 text-white shadow-md shadow-pine-900/20">
          <Settings size={22} />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Perfil y ajustes
          </h1>
          <p className="text-sm text-ink/50">Tu cuenta, apariencia y hogar</p>
        </div>
      </div>

      {/* Cuenta */}
      <AccordionSection
        id="cuenta"
        icon={<UserRound size={18} />}
        title="Tu cuenta"
        description="Foto, nombre y correo"
        open={isOpen('cuenta')}
        onToggle={() => toggleSection('cuenta')}
      >
        <div className="mb-5 flex items-center gap-4 sm:gap-5">
          <div className="relative shrink-0">
            <UserAvatar name={profile.full_name} avatarPath={profile.avatar_path} size="xl" />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={updateAvatar.isPending}
              aria-label="Cambiar foto de perfil"
              className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-pine-700 text-white shadow-md ring-2 ring-surface transition-transform hover:bg-pine-800 active:scale-95 disabled:opacity-60"
            >
              {updateAvatar.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Camera size={16} />
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={handleAvatarChange}
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-ink">
              {profile.full_name || 'Sin nombre'}
            </p>
            <p className="truncate text-sm text-ink/50">{user?.email}</p>
            {profile.avatar_path && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={removeAvatar.isPending}
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-ink/45 hover:text-coral-600 disabled:opacity-50"
              >
                <X size={12} />
                Quitar foto
              </button>
            )}
          </div>
        </div>
        <form onSubmit={saveName} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm font-medium text-ink/70">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              autoComplete="name"
              autoCapitalize="words"
              enterKeyHint="done"
              placeholder="Tu nombre"
            />
          </div>
          <button
            type="submit"
            disabled={updateProfile.isPending || !name.trim()}
            className="min-h-12 rounded-xl bg-pine-700 px-6 text-sm font-semibold text-white transition-all hover:bg-pine-800 disabled:opacity-50"
          >
            {updateProfile.isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
      </AccordionSection>

      {/* Apariencia */}
      <AccordionSection
        id="apariencia"
        icon={<Palette size={18} />}
        title="Apariencia"
        description="Personaliza cómo se ve la app"
        open={isOpen('apariencia')}
        onToggle={() => toggleSection('apariencia')}
      >
        <div className="mb-4">
          <p className="text-sm font-medium text-ink">Paleta de colores</p>
          <p className="mt-0.5 text-xs text-ink/40">
            Cambia los acentos de la app (claro y oscuro)
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PALETTES.map((p) => {
              const active = palette === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPalette(p.id)}
                  aria-pressed={active}
                  aria-label={`Paleta ${p.name}`}
                  className={cn(
                    'flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'border-pine-600 bg-pine-50 text-pine-600'
                      : 'border-slate-200 text-ink/60 hover:bg-cream',
                  )}
                >
                  <span className="flex -space-x-1.5">
                    <span
                      className="h-4 w-4 rounded-full ring-2 ring-surface"
                      style={{ backgroundColor: p.primary }}
                    />
                    <span
                      className="h-4 w-4 rounded-full ring-2 ring-surface"
                      style={{ backgroundColor: p.secondary }}
                    />
                  </span>
                  {p.name}
                </button>
              )
            })}
          </div>
        </div>
        <SettingRow
          label="Reducir animaciones"
          description="Desactiva animaciones si tu teléfono va lento"
        >
          <Toggle
            checked={reduceAnimations}
            onChange={toggleReduceAnimations}
            aria-label="Reducir animaciones"
          />
        </SettingRow>
      </AccordionSection>

      {/* Hogar */}
      <AccordionSection
        id="hogar"
        icon={<Home size={18} />}
        title="Tu hogar"
        description="Información del hogar e invitaciones"
        open={isOpen('hogar')}
        onToggle={() => toggleSection('hogar')}
      >
        {household ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pine-50 text-pine-600">
                <Home size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{household.name}</p>
                <p className="text-xs text-ink/50">
                  {members?.length ?? 0} miembro{members?.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-cream px-4 py-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink/40">
                  Código de invitación
                </p>
                <p className="text-sm font-semibold tracking-widest text-ink">
                  {household.invite_code}
                </p>
              </div>
              <button
                onClick={copyCode}
                aria-label="Copiar código de invitación"
                title="Copiar código de invitación"
                className="rounded-lg border border-slate-200 bg-surface px-3 py-2 text-sm font-medium text-ink/70 hover:bg-cream"
              >
                {copied ? <Check size={16} className="text-pine-600" /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink/50">Sin hogar — ve a /setup para crear o unirte.</p>
        )}
      </AccordionSection>

      {/* Información */}
      <AccordionSection
        id="info"
        icon={<Info size={18} />}
        title="Información"
        description="Versión y actualizaciones"
        open={isOpen('info')}
        onToggle={() => toggleSection('info')}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-cream px-4 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink/40">Versión</p>
            <p className="text-sm font-semibold text-ink">v{__APP_VERSION__}</p>
          </div>
          <button
            onClick={checkForUpdates}
            disabled={checkingUpdate}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800 disabled:opacity-60"
          >
            <RefreshCw size={16} className={checkingUpdate ? 'animate-spin' : ''} />
            {checkingUpdate ? 'Buscando…' : 'Buscar actualizaciones'}
          </button>
        </div>
        <p className="mt-3 text-xs text-ink/40">
          Cuando haya una versión nueva verás un aviso con el botón Actualizar.
        </p>
      </AccordionSection>

      {/* Zona de peligro */}
      <AccordionSection
        id="peligro"
        icon={<AlertTriangle size={18} />}
        title="Zona de peligro"
        description="Acciones que no se pueden deshacer"
        open={isOpen('peligro')}
        onToggle={() => toggleSection('peligro')}
        className="border-coral-200"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => setConfirmLeave(true)}
            disabled={!household || leaveHousehold.isPending}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-coral-200 px-4 text-sm font-medium text-coral-600 hover:bg-coral-100/60 disabled:opacity-50"
          >
            <LogOut size={18} />
            Salir del hogar
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={!household || deleteHousehold.isPending}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-coral-600 px-4 text-sm font-medium text-cream hover:bg-coral-700 disabled:opacity-50"
          >
            <Trash2 size={16} />
            Eliminar hogar
          </button>
          <button
            onClick={signOut}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-ink/70 hover:bg-cream"
          >
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </div>
      </AccordionSection>

      <div className="flex items-center justify-center gap-2 opacity-60">
        <AppLogo size={28} />
        <p className="text-xs text-ink/40">Gastos del Hogar · v{__APP_VERSION__}</p>
      </div>

      <ConfirmDialog
        open={confirmLeave}
        title="Salir del hogar"
        message="Dejarás de ver los gastos y datos de este hogar. Podrás unirte de nuevo con el código de invitación."
        confirmLabel="Salir"
        onConfirm={() => leaveHousehold.mutateAsync().then(() => setConfirmLeave(false))}
        onCancel={() => setConfirmLeave(false)}
        busy={leaveHousehold.isPending}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar hogar"
        message="Se eliminará TODO el hogar: gastos, salarios, servicios, metas y facturas. Esta acción no se puede deshacer."
        confirmLabel="Eliminar todo"
        onConfirm={() => deleteHousehold.mutateAsync().then(() => setConfirmDelete(false))}
        onCancel={() => setConfirmDelete(false)}
        busy={deleteHousehold.isPending}
      />
    </div>
  )
}
