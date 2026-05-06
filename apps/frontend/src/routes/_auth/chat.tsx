import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../store/auth'
import { useLogout } from '../../hooks/useAuth'
import { useChatWebSocket } from '../../hooks/useChatWebSocket'
import { ChatSidebar, ChatHeader, ChatMessageList, ChatInput, ChatErrorBanner, ChatReconnectIndicator } from '@/components/chat'

export const Route = createFileRoute('/_auth/chat')({
  component: ChatPage,
  validateSearch: (search: Record<string, unknown>) => ({
    threadId: typeof search.threadId === 'string' ? search.threadId : undefined,
  }),
})

function ChatPage() {
  const user = useAuthStore((s) => s.user)
  const { mutate: logout } = useLogout()
  const { threadId: urlThreadId } = Route.useSearch()
  const navigate = useNavigate()

  const {
    messages,
    setMessages,
    isLoading,
    isThinking,
    error,
    connected,
    wasEverConnected,
    sendMessage: wsSendMessage,
    connect,
    disconnect,
  } = useChatWebSocket()

  const [inputValue, setInputValue] = useState('')
  const [isFetchingThread, setIsFetchingThread] = useState(false)
  const [threadTitle, setThreadTitle] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (!urlThreadId) return
    let cancelled = false

    const loadThread = async () => {
      setIsFetchingThread(true)
      try {
        disconnect()
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
        await connect(data.thread.id)
      } catch (err) {
        console.error('Failed to load thread:', err)
      } finally {
        if (!cancelled) setIsFetchingThread(false)
      }
    }

    loadThread()
    return () => { cancelled = true }
  }, [urlThreadId, connect, disconnect, setMessages])

  const handleAutoResize = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    const content = text.trim()
    if (!content || isLoading) return

    setInputValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    let currentThreadId = threadId
    if (!currentThreadId) {
      try {
        const res = await fetch('/api/threads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        })
        if (!res.ok) throw new Error('Gagal membuat thread')
        const data = await res.json() as { id: string }
        currentThreadId = data.id
        setThreadId(data.id)
      } catch (err) {
        console.error('Failed to create thread:', err)
        return
      }
    }

    await connect(currentThreadId)
    wsSendMessage(content)
  }, [isLoading, threadId, connect, wsSendMessage])

  const regenerateLastMessage = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (lastUser) sendMessage(lastUser.content)
  }, [messages, sendMessage])

  const handleCopy = useCallback(async (id: string, content: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }, [])

  const handleNewChat = useCallback(() => {
    disconnect()
    setInputValue('')
    setThreadId(null)
    setThreadTitle(null)
    navigate({ to: '/chat', search: { threadId: undefined } })
  }, [disconnect, navigate])

  const initials = user?.displayName?.charAt(0).toUpperCase() ?? '?'

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <ChatSidebar
        initials={initials}
        displayName={user?.displayName}
        onNewChat={handleNewChat}
        onLogout={() => logout()}
      />
      <div className="flex flex-col flex-1 min-w-0">
        <ChatHeader
          isFetchingThread={isFetchingThread}
          threadTitle={threadTitle}
          onNewChat={handleNewChat}
          initials={initials}
        />
        <ChatReconnectIndicator isReconnecting={!connected && wasEverConnected && !isFetchingThread} />
        <ChatMessageList
          messages={messages}
          isFetchingThread={isFetchingThread}
          isThinking={isThinking}
          isLoading={isLoading}
          copiedId={copiedId}
          onCopy={handleCopy}
          onRegenerate={regenerateLastMessage}
          messagesEndRef={messagesEndRef}
        />
        <div className="px-6 pb-2">
          <ChatErrorBanner message={error ?? null} />
        </div>
        <ChatInput
          inputValue={inputValue}
          setInputValue={setInputValue}
          isLoading={isLoading}
          sendMessage={sendMessage}
          textareaRef={textareaRef}
          handleAutoResize={handleAutoResize}
          messagesEmpty={messages.length === 0}
        />
      </div>
    </div>
  )
}
