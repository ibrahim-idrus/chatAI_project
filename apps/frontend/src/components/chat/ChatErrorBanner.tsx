import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ChatErrorBannerProps = {
  message: string | null
  onDismiss?: () => void
}

export function ChatErrorBanner({ message, onDismiss }: ChatErrorBannerProps) {
  if (!message) return null

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2.5 text-sm',
        'bg-destructive/10 text-destructive border border-destructive/20 rounded-lg',
      )}
      role="alert"
    >
      <span className="font-medium">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-3 p-0.5 rounded hover:bg-destructive/20 transition-colors"
          aria-label="Tutup"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
