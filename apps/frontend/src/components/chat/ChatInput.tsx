import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Send, Loader2 } from 'lucide-react'
import type { RefObject } from 'react'

const CHIPS = ['Design Principles', 'Color Theory', 'Typography', 'UX Research', 'AI Concepts']

export type ChatInputProps = {
  inputValue: string
  setInputValue: (v: string) => void
  isLoading: boolean
  sendMessage: (text: string) => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
  handleAutoResize: () => void
  messagesEmpty: boolean
}

export function ChatInput({
  inputValue,
  setInputValue,
  isLoading,
  sendMessage,
  textareaRef,
  handleAutoResize,
  messagesEmpty,
}: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }

  return (
    <div className="border-t bg-background px-6 py-4">
      <div className="max-w-3xl mx-auto">
        {messagesEmpty && (
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
  )
}
