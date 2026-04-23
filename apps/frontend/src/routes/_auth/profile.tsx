import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuthStore } from '../../store/auth'
import { useLogout } from '../../hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sparkles,
  MessageSquare,
  User,
  Settings,
  LogOut,
  Plus,
  Mail,
  MessageCircle,
  Coins,
  CalendarDays,
} from 'lucide-react'

export const Route = createFileRoute('/_auth/profile')({
  component: ProfilePage,
})

type Thread = {
  id: string
  title: string
  totalTokens: number
  createdAt: string
  updatedAt: string
}

async function fetchThreads(): Promise<Thread[]> {
  const res = await fetch('/api/threads', { credentials: 'include' })
  if (!res.ok) throw new Error('Gagal memuat threads')
  return res.json() as Promise<Thread[]>
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const { mutate: logout } = useLogout()
  const initials = user?.displayName?.charAt(0).toUpperCase() ?? '?'

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ['threads'],
    queryFn: fetchThreads,
  })

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 py-5">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-base tracking-tight">chatAI</span>
        </div>

        <div className="px-3 pb-3">
          <Link to="/chat" search={{ threadId: undefined }}>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </Button>
          </Link>
        </div>

        <Separator className="bg-sidebar-border" />

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-1">
          <p className="px-2 py-1 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
            Menu
          </p>
          <Link
            to="/chat"
            search={{ threadId: undefined }}
            className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Chat
          </Link>
          <Link
            to="/profile"
            className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm font-medium bg-sidebar-accent text-sidebar-accent-foreground"
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

        {/* User */}
        <div className="p-3">
          <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-sidebar-accent transition-colors">
            <Avatar className="w-8 h-8 shrink-0">
              <AvatarFallback className="bg-sidebar-primary text-white text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.displayName ?? ''}</p>
              <p className="text-xs text-sidebar-foreground/50">Free plan</p>
            </div>
            <button
              onClick={() => logout()}
              title="Logout"
              className="p-1 rounded hover:bg-sidebar-border text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b bg-background">
          <h1 className="font-semibold text-base">Profile</h1>
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </header>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
            {/* Profile Card */}
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-semibold">{user?.displayName}</h2>
                    <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                      <Mail className="w-3.5 h-3.5" />
                      <span>{user?.email}</span>
                    </div>
                    <div className="mt-2">
                      <Badge variant="secondary" className="capitalize">
                        {user?.role ?? 'user'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="shadow-sm">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                      <MessageCircle className="w-4.5 h-4.5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{threads.length}</p>
                      <p className="text-xs text-muted-foreground">Total Chats</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                      <Coins className="w-4.5 h-4.5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {threads.reduce((s, t) => s + t.totalTokens, 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">Total Tokens</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Threads */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recent Chat History</CardTitle>
                <CardDescription>Your latest conversations</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : threads.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <MessageSquare className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Belum ada chat history.</p>
                    <Link to="/chat" search={{ threadId: undefined }}>
                      <Button variant="outline" size="sm" className="mt-1">
                        Start your first chat
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y">
                    {threads.map((thread) => (
                      <Link
                        key={thread.id}
                        to="/chat"
                        search={{ threadId: thread.id }}
                        className="flex items-center gap-3 py-3 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                          <MessageSquare className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                            {thread.title}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <CalendarDays className="w-3 h-3" />
                              {formatDate(thread.updatedAt)}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Coins className="w-3 h-3" />
                              {thread.totalTokens.toLocaleString()} tokens
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
