import Modal from '@/components/ui/Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Eliminar',
  onConfirm,
  onCancel,
  busy = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p className="mb-5 text-sm text-ink/55">{message}</p>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={busy}
          className="inline-flex min-h-12 items-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-cream disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          data-testid="confirm-dialog-confirm"
          onClick={onConfirm}
          disabled={busy}
          className="inline-flex min-h-12 items-center rounded-lg bg-coral-600 px-4 py-2 text-sm font-medium text-white hover:bg-coral-700 disabled:opacity-50"
        >
          {busy ? 'Procesando…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
