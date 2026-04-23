import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '../../store/auth'
import { useLogout } from '../../hooks/useAuth'
import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Sparkles,
  MessageSquare,
  User,
  Settings,
  LogOut,
  Plus,
  Send,
  Copy,
  RefreshCw,
  Check,
  History,
  Loader2,
} from 'lucide-react'

export const Route = createFileRoute('/_auth/chat')({
  component: ChatPage,
  validateSearch: (search: Record<string, unknown>) => ({
    threadId: typeof search.threadId === 'string' ? search.threadId : undefined,
  }),
})

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const CHIPS = ['Design Principles', 'Color Theory', 'Typography', 'UX Research', 'AI Concepts']

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function ChatPage() {
  const user = useAuthStore((s) => s.user)
  const { mutate: logout } = useLogout()
  const { threadId: urlThreadId } = Route.useSearch()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [isFetchingThread, setIsFetchingThread] = useState(false)
  const [threadTitle, setThreadTitle] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Load existing thread when navigated from history
  useEffect(() => {
    if (!urlThreadId) return
    let cancelled = false

    const loadThread = async () => {
      setIsFetchingThread(true)
      try {
        const res = await fetch(`/api/threads/${urlThreadId}`, { credentials: 'include' })
        if (!res.ok) throw new Error('Thread not found')
        const data = await res.json() as {
          thread: { id: string; title: string }
          messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; createdAt: string }>
        }
        if (cancelled) return
        setThreadId(data.thread.id)
        setThreadTitle(data.thread.title)
        setMessages(
          data.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.createdAt),
          })),
        )
      } catch {
        // silently fail — stay on empty chat
      } finally {
        if (!cancelled) setIsFetchingThread(false)
      }
    }

    loadThread()
    return () => { cancelled = true }
  }, [urlThreadId])

  const handleAutoResize = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }

  const getOrCreateThread = async (): Promise<string> => {
    if (threadId) return threadId
    const res = await fetch('/api/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Gagal membuat thread')
    const data = await res.json() as { id: string }
    setThreadId(data.id)
    return data.id
  }

  const sendMessage = async (text: string) => {
    const content = text.trim()
    if (!content || isLoading) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content, timestamp: new Date() }
    setMessages((prev) => [...prev, userMsg])
    setInputValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setIsLoading(true)
    setIsThinking(true)

    const aiMsgId = crypto.randomUUID()

    try {
      const currentThreadId = await getOrCreateThread()
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ threadId: currentThreadId, content }),
      })
      if (!res.ok || !res.body) throw new Error('Stream failed')

      // First chunk arrived — stop thinking, add assistant bubble
      setIsThinking(false)
      setMessages((prev) => [...prev, { id: aiMsgId, role: 'assistant', content: '', timestamp: new Date() }])

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, content: m.content + chunk } : m)),
        )
      }
    } catch {
      setIsThinking(false)
      setMessages((prev) => {
        const hasAiMsg = prev.some((m) => m.id === aiMsgId)
        if (hasAiMsg) {
          return prev.map((m) =>
            m.id === aiMsgId ? { ...m, content: 'Maaf, terjadi kesalahan. Coba lagi.' } : m,
          )
        }
        return [...prev, { id: aiMsgId, role: 'assistant', content: 'Maaf, terjadi kesalahan. Coba lagi.', timestamp: new Date() }]
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }

  const handleCopy = async (id: string, content: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleNewChat = () => {
    setMessages([])
    setInputValue('')
    setThreadId(null)
    setThreadTitle(null)
    navigate({ to: '/chat', search: { threadId: undefined } })
  }

  const initials = user?.displayName?.charAt(0).toUpperCase() ?? '?'
  const isLastMsgStreaming = (id: string) =>
    isLoading && id === messages[messages.length - 1]?.id

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
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewChat}
            className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>

        <Separator className="bg-sidebar-border" />

        {/* Nav */}
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
          <h1 className="font-semibold text-base truncate max-w-xs">
            {isFetchingThread ? 'Memuat...' : (threadTitle ?? 'New Chat')}
          </h1>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleNewChat} className="gap-1.5">
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

        {/* Messages */}
        <ScrollArea className="flex-1 px-6 py-4">
          {isFetchingThread ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Memuat percakapan...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-base">Cognitive Canvas</p>
                <p className="text-sm text-muted-foreground mt-1">Start a conversation...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-3xl mx-auto">
              {messages.map((msg) =>
                msg.role === 'assistant' ? (
                  <div key={msg.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                        Cognitive AI
                      </p>
                      <div className="bg-card border rounded-xl p-4 shadow-sm">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                          {isLastMsgStreaming(msg.id) && (
                            <span className="inline-block w-0.5 h-4 bg-foreground/70 ml-0.5 animate-blink align-text-bottom" />
                          )}
                        </p>
                      </div>
                      {(!isLoading || !isLastMsgStreaming(msg.id)) && msg.content && (
                        <div className="flex items-center gap-1 mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                            onClick={() => handleCopy(msg.id, msg.content)}
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3 h-3 text-green-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            {copiedId === msg.id ? 'Copied' : 'Copy'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                            onClick={() => {
                              const lastUser = [...messages].reverse().find((m) => m.role === 'user')
                              if (lastUser) sendMessage(lastUser.content)
                            }}
                          >
                            <RefreshCw className="w-3 h-3" />
                            Regenerate
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[75%]">
                      <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 text-right">
                        Read {formatTime(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                ),
              )}
              {isThinking && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                      Cognitive AI
                    </p>
                    <div className="bg-card border rounded-xl px-4 py-3 shadow-sm inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Bottom Input */}
        <div className="border-t bg-background px-6 py-4">
          <div className="max-w-3xl mx-auto">
            {messages.length === 0 && (
              <div className="flex gap-2 mb-3 flex-wrap">
                {CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => sendMessage(chip)}
                    className="px-3 py-1.5 text-xs rounded-full border border-border bg-secondary text-secondary-foreground hover:bg-accent hover:border-accent transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            <div className={cn(
              "flex items-end gap-3 bg-muted rounded-xl p-3 border transition-all",
              isLoading
                ? "border-amber-300/60 bg-amber-50/30 dark:bg-amber-950/10"
                : "border-border focus-within:border-ring focus-within:ring-1 focus-within:ring-ring",
            )}>
              <textarea
                ref={textareaRef}
                className="flex-1 bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground min-h-[24px] max-h-[120px] leading-relaxed disabled:opacity-50"
                placeholder={isLoading ? 'AI sedang membalas...' : 'Ask anything...'}
                value={inputValue}
                rows={1}
                onChange={(e) => {
                  setInputValue(e.target.value)
                  handleAutoResize()
                }}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
              <Button
                size="icon"
                onClick={() => sendMessage(inputValue)}
                disabled={isLoading || !inputValue.trim()}
                className="w-8 h-8 shrink-0 rounded-lg"
                aria-label="Send"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-2">
              Press <kbd className="px-1 py-0.5 text-xs bg-muted border rounded">Enter</kbd> to send,{' '}
              <kbd className="px-1 py-0.5 text-xs bg-muted border rounded">Shift+Enter</kbd> for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
