import { errorMessage } from '@/lib/utils'

export default function QueryError({ error }: { error: unknown }) {
  return (
    <div className="rounded-2xl border border-coral-200 hover:bg-coral-100/70 p-6 text-center">
      <p className="text-sm font-medium text-red-700">No se pudieron cargar los datos</p>
      <p className="mt-1 text-xs text-coral-500">{errorMessage(error)}</p>
    </div>
  )
}
