import { openDB } from 'idb'

// Outbox FIFO en IndexedDB: operaciones que no se pudieron enviar por
// falta de red. Se drenan en orden al reconectar (sync.ts).
export type PendingOp = {
  key: number
  entity: 'expenses' | 'incomes' | 'salaries'
  op: 'add' | 'update' | 'delete'
  rowId: string
  payload: Record<string, unknown>
  createdAt: number
}

const DB_NAME = 'gastos-offline'
const STORE = 'queue'

let dbPromise: ReturnType<typeof openDB> | null = null

function db() {
  dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore(STORE, { keyPath: 'key', autoIncrement: true })
    },
  })
  return dbPromise
}

export async function enqueueOp(
  op: Omit<PendingOp, 'key' | 'createdAt'>,
): Promise<void> {
  await (await db()).add(STORE, { ...op, createdAt: Date.now() })
}

export async function listOps(): Promise<PendingOp[]> {
  return (await db()).getAll(STORE)
}

export async function removeOp(key: number): Promise<void> {
  await (await db()).delete(STORE, key)
}
