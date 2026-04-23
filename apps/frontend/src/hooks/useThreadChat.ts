import { useChat } from '@ai-sdk/react'
import { TextStreamChatTransport } from 'ai'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import type { Message } from '@chatai/types'

export function useThreadChat(threadId: string, initialMessages: Message[]) {
  const [input, setInput] = useState('')

  const { messages: rawMessages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initialMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        parts: [{ type: 'text' as const, text: m.content }],
      })),
    transport: new TextStreamChatTransport({
      api: '/api/chat/stream',
      credentials: 'include',
      prepareSendMessagesRequest: ({ messages: msgs }) => {
        const lastMsg = msgs[msgs.length - 1]
        const textPart = lastMsg?.parts.find(
          (p): p is { type: 'text'; text: string } => p.type === 'text',
        )
        return { body: { threadId, content: textPart?.text ?? '' } }
      },
    }),
    onError: (err: Error) => {
      console.error('Stream error:', err)
    },
  })

  const messages = rawMessages.map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join(''),
  }))

  function handleInputChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setInput(e.target.value)
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return
    sendMessage({ text: trimmed })
    setInput('')
  }

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading: status === 'submitted' || status === 'streaming',
    error,
  }
}
