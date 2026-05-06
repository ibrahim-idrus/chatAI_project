import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import { Copy, RefreshCw, Check, Sparkles } from 'lucide-react'
import type { Message } from '@/hooks/useChatWebSocket'

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export type ChatMessageProps = {
  msg: Message
  isLastMsgStreaming: boolean
  isLoading: boolean
  copiedId: string | null
  onCopy: (id: string, content: string) => void
  onRegenerate: () => void
}

export function ChatMessage({ msg, isLastMsgStreaming, isLoading, copiedId, onCopy, onRegenerate }: ChatMessageProps) {
  if (msg.role === 'assistant') {
    return (
      <div key={msg.id} className="flex gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
            Cognitive AI
          </p>
          <div className="bg-card border rounded-xl p-4 shadow-sm">
            <div className="prose prose-sm max-w-none text-sm leading-relaxed">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
              {isLastMsgStreaming && (
                <span className="inline-block w-0.5 h-4 bg-foreground/70 ml-0.5 animate-blink align-text-bottom" />
              )}
            </div>
          </div>
          {(!isLoading || !isLastMsgStreaming) && msg.content && (
            <div className="flex items-center gap-1 mt-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                onClick={() => onCopy(msg.id, msg.content)}
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
                onClick={onRegenerate}
              >
                <RefreshCw className="w-3 h-3" />
                Regenerate
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
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
  )
}
