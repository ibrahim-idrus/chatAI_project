import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useThreadMessages } from '../hooks/useThreadMessages'
import type { Thread } from '@chatai/types'

type Props = { thread: Thread }

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(date))
}

function formatTokens(n: number): string {
  return new Intl.NumberFormat('id-ID').format(n) + ' tokens'
}

function MessageRow({ msg }: { msg: { id: string; role: string; content: string; status: string; createdAt: Date | string } }) {
  const [expanded, setExpanded] = useState(false)
  const isUser = msg.role === 'user'
  const MAX = 200

  const bodyText =
    msg.status === 'pending'
      ? '...'
      : msg.status === 'failed'
        ? null
        : msg.content

  const truncated = bodyText && bodyText.length > MAX && !expanded

  return (
    <div className={`flex flex-col gap-0.5 ${isUser ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-center gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <Badge variant={isUser ? 'default' : 'secondary'} className="text-xs px-1.5 py-0">
          {isUser ? 'You' : 'AI'}
        </Badge>
        <span className="text-xs text-muted-foreground">{formatTime(msg.createdAt)}</span>
      </div>

      <div className={`max-w-[85%] text-sm leading-relaxed ${isUser ? 'text-right' : 'text-left'}`}>
        {msg.status === 'failed' ? (
          <Badge variant="destructive" className="text-xs">
            Gagal generate response
          </Badge>
        ) : (
          <span className="text-foreground">
            {truncated ? bodyText!.slice(0, MAX) : bodyText}
            {bodyText && bodyText.length > MAX && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="ml-1 text-xs text-primary underline underline-offset-2 hover:no-underline"
              >
                {expanded ? 'sembunyikan' : '...lihat selengkapnya'}
              </button>
            )}
          </span>
        )}
      </div>
    </div>
  )
}

export function ThreadHistoryItem({ thread }: Props) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const { data, isLoading } = useThreadMessages(open ? thread.id : null)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none py-4 px-5">
            <div className="flex items-center gap-3">
              <span className="flex-1 font-medium text-sm truncate">{thread.title}</span>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-xs font-normal">
                  {formatDate(thread.createdAt)}
                </Badge>
                <Badge variant="secondary" className="text-xs font-normal">
                  {formatTokens(thread.totalTokens)}
                </Badge>
                {open ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 px-5 pb-4">
            <div className="border-t pt-4 space-y-3">
              {isLoading ? (
                <>
                  <Skeleton className="h-8 w-3/4 ml-auto" />
                  <Skeleton className="h-10 w-4/5" />
                  <Skeleton className="h-8 w-2/3 ml-auto" />
                </>
              ) : data?.messages && data.messages.length > 0 ? (
                data.messages.map((msg) => (
                  <MessageRow key={msg.id} msg={msg} />
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Belum ada pesan.
                </p>
              )}

              <div className="pt-2 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => navigate({ to: '/chat', search: { threadId: thread.id } })}
                >
                  Buka Chat
                  <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
