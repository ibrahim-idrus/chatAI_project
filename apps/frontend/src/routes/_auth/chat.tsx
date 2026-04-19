import { createFileRoute } from '@tanstack/react-router'
import { useAuthStore } from '../../store/auth'
import { useLogout } from '../../hooks/useAuth'
import { useState, useRef, useEffect, useCallback } from 'react'
import './chat.css'

export const Route = createFileRoute('/_auth/chat')({
  component: ChatPage,
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
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleAutoResize = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }

  const sendMessage = async (text: string) => {
    const content = text.trim()
    if (!content || isLoading) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInputValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    setIsLoading(true)

    const aiMsgId = crypto.randomUUID()
    setMessages((prev) => [
      ...prev,
      { id: aiMsgId, role: 'assistant', content: '', timestamp: new Date() },
    ])

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok || !res.body) throw new Error('Stream failed')

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
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId ? { ...m, content: 'Maaf, terjadi kesalahan. Coba lagi.' } : m,
        ),
      )
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
  }

  const initials = user?.displayName?.charAt(0).toUpperCase() ?? '?'

  return (
    <div className="chat-shell">
      {/* Sidebar */}
      <aside className="chat-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" fill="#ffffff"/>
            </svg>
          </div>
          <p className="sidebar-brand-name">chatAI</p>
        </div>

        <button className="sidebar-new-btn" onClick={handleNewChat}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13H13v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          New Chat
        </button>

        <p className="sidebar-section-label">Menu</p>
        <nav className="sidebar-nav">
          <button className="sidebar-nav-item active">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
            </svg>
            Chat
          </button>
          <button className="sidebar-nav-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
            </svg>
            History
          </button>
          <button className="sidebar-nav-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
            </svg>
            Settings
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div className="avatar-circle" style={{ width: 34, height: 34, fontSize: 13 }}>
              {initials}
            </div>
            <div className="sidebar-user-info">
              <p className="sidebar-user-name">{user?.displayName ?? ''}</p>
              <p className="sidebar-user-role">Free plan</p>
            </div>
            <button className="sidebar-logout-btn" onClick={() => logout()} title="Logout">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="chat-main">
      {/* Header */}
      <header className="chat-header">
        <div className="chat-header-left">
          <h1 className="chat-header-title">New Chat</h1>
        </div>
        <div className="chat-header-right">
          <button className="btn-new-chat" onClick={handleNewChat}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13H13v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
            New
          </button>
          <div className="avatar-circle" title={user?.displayName ?? ''}>
            {initials}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"
                  fill="#9ca3af"
                />
                <path
                  d="M19 14L19.75 17.25L23 18L19.75 18.75L19 22L18.25 18.75L15 18L18.25 17.25L19 14Z"
                  fill="#d1d5db"
                />
              </svg>
            </div>
            <p className="empty-title">Cognitive Canvas</p>
            <p className="empty-sub">Start a conversation...</p>
          </div>
        ) : (
          messages.map((msg) =>
            msg.role === 'assistant' ? (
              <div key={msg.id} className="msg-ai-row">
                <div className="ai-badge">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"
                      fill="#f59e0b"
                    />
                    <path
                      d="M19 14L19.75 17.25L23 18L19.75 18.75L19 22L18.25 18.75L15 18L18.25 17.25L19 14Z"
                      fill="#fcd34d"
                    />
                  </svg>
                </div>
                <div className="ai-card">
                  <p className="ai-card-label">Cognitive AI</p>
                  <p className={`ai-card-body${isLoading && msg.content === '' ? ' streaming' : msg.id === messages[messages.length - 1]?.id && isLoading ? ' streaming' : ''}`}>
                    {msg.content || ' '}
                  </p>
                  {!isLoading || msg.id !== messages[messages.length - 1]?.id ? (
                    <div className="ai-card-actions">
                      <button
                        className={`ai-action-btn${copiedId === msg.id ? ' copied' : ''}`}
                        onClick={() => handleCopy(msg.id, msg.content)}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                        </svg>
                        {copiedId === msg.id ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        className="ai-action-btn"
                        onClick={() => {
                          const lastUser = [...messages].reverse().find((m) => m.role === 'user')
                          if (lastUser) sendMessage(lastUser.content)
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                        </svg>
                        Regenerate
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div key={msg.id} className="msg-user-row">
                <div className="msg-user-wrap">
                  <div className="msg-user-bubble">{msg.content}</div>
                  <span className="msg-user-time">Read {formatTime(msg.timestamp)}</span>
                </div>
              </div>
            ),
          )
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom */}
      <div className="chat-bottom">
        {messages.length === 0 && (
          <div className="chip-row">
            {CHIPS.map((chip) => (
              <button key={chip} className="chip" onClick={() => sendMessage(chip)}>
                {chip}
              </button>
            ))}
          </div>
        )}

        <div className="chat-input-row">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder="Ask anything..."
            value={inputValue}
            rows={1}
            onChange={(e) => {
              setInputValue(e.target.value)
              handleAutoResize()
            }}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            className="send-btn"
            onClick={() => sendMessage(inputValue)}
            disabled={isLoading || !inputValue.trim()}
            aria-label="Send"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>

      </div>
      </div>
    </div>
  )
}
