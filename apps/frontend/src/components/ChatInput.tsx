import { useRef, useEffect, type FormEvent, type ChangeEvent, type KeyboardEvent } from 'react'

const MAX_CHARS = 10_000
const WARN_CHARS = 8_000

type ChatInputProps = {
  input: string
  handleInputChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void
  isLoading: boolean
}

export function ChatInput({ input, handleInputChange, handleSubmit, isLoading }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = 24
    const maxHeight = lineHeight * 5
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }, [input])

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isLoading && input.trim()) {
        const form = e.currentTarget.closest('form')
        form?.requestSubmit()
      }
    }
  }

  const remaining = MAX_CHARS - input.length
  const showCount = input.length > WARN_CHARS

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 p-3 border-t bg-white">
      <div className="relative flex-1">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={onKeyDown}
          disabled={isLoading}
          rows={1}
          maxLength={MAX_CHARS}
          placeholder="Tulis pesan..."
          className="w-full resize-none rounded-xl border border-gray-300 px-4 py-2.5 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 overflow-y-auto"
          style={{ lineHeight: '24px' }}
        />
        {showCount && (
          <span
            className={`absolute bottom-2 right-3 text-xs ${
              remaining < 500 ? 'text-red-500' : 'text-gray-400'
            }`}
          >
            {remaining}
          </span>
        )}
      </div>
      <button
        type="submit"
        disabled={isLoading || !input.trim()}
        className="flex-shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'Mengirim...' : 'Kirim'}
      </button>
    </form>
  )
}
