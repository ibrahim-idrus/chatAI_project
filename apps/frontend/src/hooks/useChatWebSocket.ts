import { useState, useRef, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChatWebSocket } from '../lib/chat-ws'

export type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export function useChatWebSocket() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [wasEverConnected, setWasEverConnected] = useState(false)

  const wsRef = useRef<ChatWebSocket | null>(null)
  const assistantMsgIdRef = useRef<string | null>(null)
  const onThreadNameRef = useRef<((title: string) => void) | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    wsRef.current = new ChatWebSocket()
    return () => {
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [])

  const connect = useCallback((threadId: string): Promise<void> => {
    return new Promise((resolve) => {
      const ws = wsRef.current
      if (!ws) return resolve()

      ws.onOpen(() => {
        setConnected(true)
        setWasEverConnected(true)
        resolve()
      })

      ws.onToken((token: string) => {
        setMessages((prev) => {
          const aiMsgId = assistantMsgIdRef.current
          if (!aiMsgId) return prev
          return prev.map((m) =>
            m.id === aiMsgId ? { ...m, content: m.content + token } : m,
          )
        })
      })

      ws.onDone((data: { messageId: string; tokenCount: number }) => {
        const aiMsgId = assistantMsgIdRef.current
        if (aiMsgId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId ? { ...m, id: data.messageId } : m,
            ),
          )
        }
        setIsLoading(false)
        setIsThinking(false)
        assistantMsgIdRef.current = null
      })

      ws.onError((msg: string) => {
        const aiMsgId = assistantMsgIdRef.current
        setError(msg)
        setIsLoading(false)
        setIsThinking(false)
        if (aiMsgId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? { ...m, content: 'Maaf, terjadi kesalahan. Coba lagi.' }
                : m,
            ),
          )
        }
        assistantMsgIdRef.current = null
      })

      ws.onStatus((status: string) => {
        if (status === 'connected') {
          setConnected(true)
          setWasEverConnected(true)
        }
      })

      ws.onThreadName((title: string) => {
        queryClient.invalidateQueries({ queryKey: ['threads', 'history'] })
        onThreadNameRef.current?.(title)
      })

      ws.connect(threadId)
    })
  }, [])

  const sendMessage = useCallback((content: string) => {
    if (!content.trim() || isLoading) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    const aiMsgId = crypto.randomUUID()
    assistantMsgIdRef.current = aiMsgId

    const aiPlaceholder: Message = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg, aiPlaceholder])
    setIsLoading(true)
    setIsThinking(true)
    setError(null)

    wsRef.current?.send(content.trim())
  }, [isLoading])

  const disconnect = useCallback(() => {
    wsRef.current?.close()
    if (wsRef.current) {
      wsRef.current = new ChatWebSocket()
    }
    setMessages([])
    setIsLoading(false)
    setIsThinking(false)
    setError(null)
    setConnected(false)
    setWasEverConnected(false)
    assistantMsgIdRef.current = null
  }, [])

  return {
    messages,
    setMessages,
    isLoading,
    isThinking,
    error,
    connected,
    wasEverConnected,
    sendMessage,
    connect,
    disconnect,
    setOnThreadName: (cb: (title: string) => void) => { onThreadNameRef.current = cb },
  }
}
