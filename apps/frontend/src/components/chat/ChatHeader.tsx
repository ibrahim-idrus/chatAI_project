import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Plus } from 'lucide-react'

export type ChatHeaderProps = {
  isFetchingThread: boolean
  threadTitle: string | null
  onNewChat: () => void
  initials: string
}

export function ChatHeader({ isFetchingThread, threadTitle, onNewChat, initials }: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b bg-background">
      <h1 className="font-semibold text-base truncate max-w-xs">
        {isFetchingThread ? 'Memuat...' : (threadTitle ?? 'New Chat')}
      </h1>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onNewChat} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          New
        </Button>
        <Link to="/profile">
          <Avatar className="w-8 h-8 cursor-pointer">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  )
}
