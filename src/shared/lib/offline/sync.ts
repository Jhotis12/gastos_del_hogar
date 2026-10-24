import { listOps, removeOp, type PendingOp } from './queue'
import { isNetworkError } from './isNetworkError'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { emitToast } from '@/shared/components/ui/Toast'
import { supabase } from '@/shared/lib/supabase'
import { errorMessage } from '@/shared/lib/utils'
import type { QueryClient } from '@tanstack/react-query'

// Referencia al QueryClient de la app: se inyecta desde main.tsx para poder
// invalidar todas las queries tras un sync (refetch de datos frescos).
let queryClient: QueryClient | null = null

export function attachQueryClient(qc: QueryClient): void {
  queryClient = qc
}

// Estado global de conectividad + cola: se consume con useSyncExternalStore
// (ver hooks/useOffline.ts) y desde el banner / las notificaciones.
export interface OfflineStatus {
  isOnline: boolean
  pending: number
  syncing: boolean
  lastSyncAt: number | null
}

let status: OfflineStatus = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pending: 0,
  syncing: false,
  lastSyncAt: null,
}

const listeners = new Set<() => void>()

function setStatus(patch: Partial<OfflineStatus>) {
  status = { ...status, ...patch }
  for (const listener of listeners) listener()
}

export function getOfflineStatus(): OfflineStatus {
  return status
}

export function subscribeOfflineStatus(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

let draining = false
let started = false

export async function refreshPendingCount(): Promise<number> {
  const ops = await listOps()
  setStatus({ pending: ops.length })
  return ops.length
}

// Errores idempotentes: reintentar la misma operación ya aplicada no debe
// fallar (at-least-once → replay idempotente).
function isDuplicateKey(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === '23505'
  )
}

function isZeroRows(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'PGRST116'
  )
}

async function replay(op: PendingOp): Promise<'ok' | 'retry' | 'fail'> {
  try {
    let error: { message: string; code?: string } | null = null

    if (op.entity === 'expenses') {
      if (op.op === 'add') {
        const res = await supabase.from('expenses').insert(op.payload).select().single()
        error = res.error
        if (isDuplicateKey(error)) return 'ok'
      } else if (op.op === 'update') {
        const { id, ...rest } = op.payload
        const res = await supabase.from('expenses').update(rest).eq('id', id)
        error = res.error
        if (isZeroRows(error)) return 'ok'
      } else {
        const res = await supabase.from('expenses').delete().eq('id', op.rowId)
        error = res.error
      }
    } else if (op.entity === 'incomes') {
      if (op.op === 'add') {
        const res = await supabase.from('incomes').insert(op.payload).select().single()
        error = res.error
        if (isDuplicateKey(error)) return 'ok'
      } else if (op.op === 'update') {
        const { id, ...rest } = op.payload
        const res = await supabase.from('incomes').update(rest).eq('id', id)
        error = res.error
        if (isZeroRows(error)) return 'ok'
      } else {
        const res = await supabase.from('incomes').delete().eq('id', op.rowId)
        error = res.error
      }
    } else {
      // salarios: el upsert se rehace con su lógica (fila por profile+mes)
      if (op.op === 'add') {
        const payload = op.payload as {
          profile_id: string
          month: string
          amount: number
          pay_date?: string
        }
        const { data: existing } = await supabase
          .from('salaries')
          .select('id')
          .eq('profile_id', payload.profile_id)
          .eq('month', payload.month)
          .maybeSingle()
        if (existing?.id) {
          const res = await supabase
            .from('salaries')
            .update({ amount: payload.amount, pay_date: payload.pay_date })
            .eq('id', existing.id)
          error = res.error
        } else {
          const res = await supabase.from('salaries').insert(op.payload)
          error = res.error
        }
      } else {
        const res = await supabase.from('salaries').delete().eq('id', op.rowId)
        error = res.error
      }
    }

    if (error) {
      if (isNetworkError(error) || isAuthRetryableFetchError(error as unknown as Error)) return 'retry'
      if (
        op.entity === 'expenses' &&
        (error.code === '42501' || /row-level security/i.test(error.message))
      ) {
        emitToast(
          'error',
          'Gasto sin pagador válido: edítalo para asignar un miembro del hogar',
        )
        return 'fail'
      }
      emitToast('error', `No se pudo sincronizar: ${error.message}`)
      return 'fail'
    }
    return 'ok'
  } catch (err) {
    if (isNetworkError(err) || isAuthRetryableFetchError(err as Error)) return 'retry'
    emitToast('error', `No se pudo sincronizar: ${errorMessage(err)}`)
    return 'fail'
  }
}

// Drena la cola en orden FIFO. Cada ítem se rehace contra Supabase; si la
// red falla se detiene (el heartbeat lo reintenta) y los errores reales
// (RLS/validación) descartan el ítem con aviso.
export async function syncNow(): Promise<void> {
  if (draining || !status.isOnline) return

  const ops = await listOps()
  if (ops.length === 0) {
    setStatus({ syncing: false, lastSyncAt: Date.now() })
    return
  }

  draining = true
  setStatus({ syncing: true })
  let synced = 0
  try {
    for (;;) {
      let session = null
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error && (isNetworkError(error) || isAuthRetryableFetchError(error as unknown as Error))) {
          if (import.meta.env.DEV) console.debug('[sync] getSession retryable', error)
          break
        }
        session = data.session
      } catch (err) {
        if (isNetworkError(err) || isAuthRetryableFetchError(err as Error)) {
          if (import.meta.env.DEV) console.debug('[sync] getSession catch retryable', err)
          break
        }
        break
      }
      if (!session) break
      const [op] = await listOps()
      if (!op) break
      const result = await replay(op)
      if (result === 'retry') break
      await removeOp(op.key)
      if (result === 'ok') synced++
    }
  } finally {
    draining = false
    const pending = await refreshPendingCount()
    setStatus({ syncing: false, lastSyncAt: Date.now() })
    if (synced > 0) {
      emitToast(
        'success',
        synced === 1 ? 'Cambio sincronizado' : `${synced} cambios sincronizados`,
      )
    }
    if (pending === 0) {
      setStatus({ lastSyncAt: Date.now() })
    }
    if (synced > 0 && queryClient) {
      // Datos frescos tras el sync: los cambios offline (y las
      // invalidaciones omitidas por invalidateIfOnline) se reflejan ya.
      queryClient.invalidateQueries()
    }
  }
}

async function handleOffline() {
  setStatus({ isOnline: false })
  // Sin toast: el indicador sutil (antena wifi) en la esquina es suficiente.
  await refreshPendingCount()
}

async function handleOnline() {
  setStatus({ isOnline: true })
  try {
    // Tras un boot offline la sesión puede no estar en memoria: esto la
    // restaura desde localStorage antes de drenar.
    await supabase.auth.getSession()
  } catch (err) {
    if (import.meta.env.DEV && (isNetworkError(err) || isAuthRetryableFetchError(err as Error))) {
      console.debug('[sync] handleOnline getSession retryable', err)
    }
    /* sin red — el heartbeat reintentará */
  }
  emitToast('success', 'De vuelta en línea')
  void syncNow()
}

// Se llama una sola vez desde main.tsx. Escucha cambios de red, drena al
// arrancar si quedaron pendientes y hace heartbeat de verificación.
export function initOfflineWatcher(): void {
  if (started) return
  started = true

  void refreshPendingCount()

  window.addEventListener('offline', () => {
    void handleOffline()
  })
  window.addEventListener('online', () => {
    void handleOnline()
  })
  window.addEventListener('focus', () => {
    if (navigator.onLine && status.pending > 0) void syncNow()
  })

  setInterval(() => {
    if (navigator.onLine && !draining && status.pending > 0) void syncNow()
  }, 15000)

  if (navigator.onLine) {
    void syncNow()
  } else {
    void handleOffline()
  }
}
