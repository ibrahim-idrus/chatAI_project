import { useEffect, useRef } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

type InfiniteScrollTriggerProps = {
  onIntersect: () => void
  hasMore: boolean
  isLoading: boolean
}

export function InfiniteScrollTrigger({ onIntersect, hasMore, isLoading }: InfiniteScrollTriggerProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoading) {
          onIntersect()
        }
      },
      { threshold: 0.1 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [onIntersect, hasMore, isLoading])

  if (isLoading) {
    return (
      <div className="px-4 py-3 space-y-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    )
  }

  if (!hasMore) {
    return (
      <div ref={ref} className="py-6 px-4">
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground shrink-0">
            Semua riwayat sudah ditampilkan
          </span>
          <Separator className="flex-1" />
        </div>
      </div>
    )
  }

  return <div ref={ref} className="h-4" />
}
