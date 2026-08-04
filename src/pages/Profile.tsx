import { useState } from 'react'
import { Copy, Check, Home, LogOut, Settings, Trash2, UserRound } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useHousehold } from '@/hooks/useHousehold'
import { useMembers } from '@/hooks/useMembers'
import { useDeleteHousehold, useLeaveHousehold, useUpdateProfile } from '@/hooks/useMembers'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import PageSkeleton from '@/components/ui/PageSkeleton'
import { useToast } from '@/components/ui/Toast'
import AppLogo from '@/components/ui/AppLogo'
import { errorMessage } from '@/lib/utils'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-surface px-4 py-3 text-base text-ink placeholder:text-ink/35 focus:border-pine-500 focus:outline-none focus:ring-2 focus:ring-pine-500/20'

export default function Profile() {
  const { user, profile, signOut } = useAuth()
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

  const copyCode = async () => {
    if (!household) return
    await navigator.clipboard.writeText(household.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="animate-fade-up flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pine-600 to-pine-800 text-white shadow-md shadow-pine-900/20">
          <Settings size={22} />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Perfil y Hogar
          </h1>
          <p className="text-sm text-ink/50">Gestiona tu cuenta y el hogar</p>
        </div>
      </div>

      {/* Tu cuenta */}
      <div className="card animate-fade-up p-6" style={{ animationDelay: '80ms' }}>
        <h2 className="mb-4 font-display text-sm font-semibold text-ink">Tu cuenta</h2>
        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-pine-50 text-pine-600">
            <UserRound size={26} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-ink">
              {profile.full_name || 'Sin nombre'}
            </p>
            <p className="truncate text-sm text-ink/50">{user?.email}</p>
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
      </div>

      {/* Hogar */}
      <div className="card animate-fade-up p-6" style={{ animationDelay: '160ms' }}>
        <h2 className="mb-4 font-display text-sm font-semibold text-ink">Tu hogar</h2>
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
                className="rounded-lg border border-slate-200 bg-surface px-3 py-2 text-sm font-medium text-ink/70 hover:bg-cream"
              >
                {copied ? <Check size={16} className="text-pine-600" /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink/50">Sin hogar — ve a /setup para crear o unirte.</p>
        )}
      </div>

      {/* Zona de peligro */}
      <div className="card animate-fade-up border-coral-200 p-6" style={{ animationDelay: '240ms' }}>
        <h2 className="mb-2 font-display text-sm font-semibold text-coral-600">
          Zona de peligro
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => setConfirmLeave(true)}
            disabled={!household || leaveHousehold.isPending}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-coral-200 px-4 text-sm font-medium text-coral-600 hover:bg-coral-100/60 disabled:opacity-50"
          >
            <LogOut size={16} />
            Salir del hogar
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={!household || deleteHousehold.isPending}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-coral-600 px-4 text-sm font-medium text-white hover:bg-coral-700 disabled:opacity-50"
          >
            <Trash2 size={16} />
            Eliminar hogar
          </button>
          <button
            onClick={signOut}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-ink/70 hover:bg-cream"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 opacity-60">
        <AppLogo size={28} />
        <p className="text-xs text-ink/40">Gastos del Hogar · versión 1.0</p>
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
