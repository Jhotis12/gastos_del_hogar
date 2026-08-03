import { openDB } from 'idb'
import {
  experimental_createQueryPersister,
  type AsyncStorage,
} from '@tanstack/query-persist-client-core'

// Caché de queries persistida en IndexedDB: cada query exitosa se guarda
// aquí y se sirve de inmediato en un arranque sin red (últimos datos
// conocidos). El persister por query funciona sin hydratación global.
const DB_NAME = 'gastos-query-cache'
const STORE = 'queries'

const dbPromise = openDB(DB_NAME, 1, {
  upgrade(d) {
    d.createObjectStore(STORE)
  },
})

const storage: AsyncStorage<string> = {
  getItem: async (key) => (await dbPromise).get(STORE, key) ?? null,
  setItem: async (key, value) => {
    await (await dbPromise).put(STORE, value, key)
  },
  removeItem: async (key) => {
    await (await dbPromise).delete(STORE, key)
  },
  entries: async () => {
    const db = await dbPromise
    const keys = (await db.getAllKeys(STORE)) as string[]
    const values = (await db.getAll(STORE)) as string[]
    return keys.map((key, i) => [key, values[i]])
  },
}

export const queryPersister = experimental_createQueryPersister({
  storage,
  buster: 'v1',
  maxAge: 1000 * 60 * 60 * 24 * 30,
  // 'always': tras un sync offline, los datos del servidor cambian; un
  // arranque dentro de staleTime (30s) serviría caché vieja sin refetch.
  // Con 'always' se refetcha en cada boot (cuando hay red) para mostrar
  // siempre lo último del servidor.
  refetchOnRestore: 'always',
})

export async function clearPersistedCache(): Promise<void> {
  await queryPersister.removeQueries()
}
