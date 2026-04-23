import ReactMarkdown from 'react-markdown'

type ChatMessageProps = {
  message: {
    id: string
    role: 'user' | 'assistant'
    content: string
    status?: 'pending' | 'completed' | 'failed'
  }
}

function PendingDots() {
  return (
    <span className="flex gap-1 items-center h-5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  )
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const status = message.status

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {status === 'failed' ? (
        <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-red-100 text-red-700 text-sm">
          Gagal generate response
        </div>
      ) : (
        <div
          className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
            isUser
              ? 'bg-blue-600 text-white rounded-br-sm'
              : 'bg-gray-100 text-gray-900 rounded-bl-sm'
          }`}
        >
          {status === 'pending' ? (
            <PendingDots />
          ) : isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
