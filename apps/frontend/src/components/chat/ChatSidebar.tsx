import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Sparkles,
  MessageSquare,
  User,
  Settings,
  LogOut,
  Plus,
  History,
} from 'lucide-react'

export type ChatSidebarProps = {
  initials: string
  displayName: string | undefined
  onNewChat: () => void
  onLogout: () => void
}

export function ChatSidebar({ initials, displayName, onNewChat, onLogout }: ChatSidebarProps) {
  return (
    <aside className="w-60 shrink-0 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-base tracking-tight">chatAI</span>
      </div>

      <div className="px-3 pb-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onNewChat}
          className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </Button>
      </div>

      <Separator className="bg-sidebar-border" />

      <nav className="flex-1 px-3 py-3 space-y-1">
        <p className="px-2 py-1 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
          Menu
        </p>
        <button className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm font-medium bg-sidebar-accent text-sidebar-accent-foreground">
          <MessageSquare className="w-4 h-4" />
          Chat
        </button>
        <Link
          to="/HistoryPage"
          className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <History className="w-4 h-4" />
          History
        </Link>
        <Link
          to="/profile"
          className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <User className="w-4 h-4" />
          Profile
        </Link>
        <button className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </nav>

      <Separator className="bg-sidebar-border" />

      <div className="p-3">
        <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-sidebar-accent transition-colors">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarFallback className="bg-sidebar-primary text-white text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{displayName ?? ''}</p>
            <p className="text-xs text-sidebar-foreground/50">Free plan</p>
          </div>
          <button
            onClick={onLogout}
            title="Logout"
            className="p-1 rounded hover:bg-sidebar-border text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
