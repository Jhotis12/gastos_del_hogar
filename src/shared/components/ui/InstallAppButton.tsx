import { Download } from 'lucide-react'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'

export default function InstallAppButton() {
  const { canInstall, promptInstall } = useInstallPrompt()

  if (!canInstall) return null

  return (
    <button
      onClick={promptInstall}
      className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-ink/70 hover:bg-cream"
    >
      <Download size={18} className="text-ink/40" />
      Instalar app
    </button>
  )
}
