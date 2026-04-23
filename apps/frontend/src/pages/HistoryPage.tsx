import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useThreadHistory } from '../hooks/useThreadHistory'
import { ThreadHistoryItem } from '../components/ThreadHistoryItem'
import { InfiniteScrollTrigger } from '../components/InfiniteScrollTrigger'
import type { Thread } from '@chatai/types'

export function HistoryPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useThreadHistory()

  const allThreads: Thread[] = data?.pages.flatMap((p) => p.threads) ?? []
  const total = data?.pages[0]?.pagination.total ?? 0

  const handleIntersect = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-5 w-24" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <p className="text-muted-foreground text-sm">Gagal memuat riwayat.</p>
            <Button variant="default" size="sm" onClick={() => refetch()}>
              Coba Lagi
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 h-screen flex flex-col">
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <h1 className="text-xl font-semibold">Riwayat Chat</h1>
        {total > 0 && (
          <Badge variant="secondary">
            {new Intl.NumberFormat('id-ID').format(total)} percakapan
          </Badge>
        )}
      </div>

      {allThreads.length === 0 ? (
        <Card className="flex-1 flex items-center justify-center">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <p className="text-muted-foreground text-sm">Belum ada riwayat chat.</p>
            <Button variant="default" onClick={() => navigate({ to: '/chat' })}>
              Mulai Chat Baru
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="flex-1 -mx-4 px-4">
          <div className="space-y-3 pb-2">
            {allThreads.map((thread) => (
              <ThreadHistoryItem key={thread.id} thread={thread} />
            ))}
            <InfiniteScrollTrigger
              onIntersect={handleIntersect}
              hasMore={hasNextPage ?? false}
              isLoading={isFetchingNextPage}
            />
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
