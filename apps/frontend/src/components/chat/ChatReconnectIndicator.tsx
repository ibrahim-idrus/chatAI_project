export type ChatReconnectIndicatorProps = {
  isReconnecting: boolean
}

export function ChatReconnectIndicator({ isReconnecting }: ChatReconnectIndicatorProps) {
  if (!isReconnecting) return null

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-amber-600 dark:text-amber-400">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
      </span>
      <span className="font-medium">Menyambung kembali...</span>
    </div>
  )
}
