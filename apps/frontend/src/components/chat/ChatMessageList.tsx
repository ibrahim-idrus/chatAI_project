import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Sparkles } from 'lucide-react'
import type { RefObject } from 'react'
import type { Message } from '@/hooks/useChatWebSocket'
import { ChatMessage } from './ChatMessage'

export type ChatMessageListProps = {
  messages: Message[]
  isFetchingThread: boolean
  isThinking: boolean
  isLoading: boolean
  copiedId: string | null
  onCopy: (id: string, content: string) => void
  onRegenerate: () => void
  messagesEndRef: RefObject<HTMLDivElement | null>
}

export function ChatMessageList({
  messages,
  isFetchingThread,
  isThinking,
  isLoading,
  copiedId,
  onCopy,
  onRegenerate,
  messagesEndRef,
}: ChatMessageListProps) {
  const isLastMsgStreaming = (id: string) =>
    isLoading && id === messages[messages.length - 1]?.id

  return (
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
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              msg={msg}
              isLastMsgStreaming={isLastMsgStreaming(msg.id)}
              isLoading={isLoading}
              copiedId={copiedId}
              onCopy={onCopy}
              onRegenerate={onRegenerate}
            />
          ))}
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
  )
}
