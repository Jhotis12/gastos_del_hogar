export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const msg = (err as { message: unknown }).message
    if (typeof msg === 'string' && msg) return msg
  }
  return 'Ocurrió un error inesperado'
}
