import { useInfiniteQuery } from '@tanstack/react-query'
import type { Thread } from '@chatai/types'

type ThreadsPage = {
  threads: Thread[]
  pagination: {
    page: number
    limit: number
    total: number
    hasMore: boolean
  }
}

async function fetchThreadsPage(page: number): Promise<ThreadsPage> {
  const res = await fetch(`/api/threads?page=${page}&limit=20`, {
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Gagal memuat riwayat')
  return res.json() as Promise<ThreadsPage>
}

export function useThreadHistory() {
  return useInfiniteQuery({
    queryKey: ['threads', 'history'],
    queryFn: ({ pageParam }) => fetchThreadsPage(pageParam),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    initialPageParam: 1,
  })
}
