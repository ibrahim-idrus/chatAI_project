import { useQuery } from '@tanstack/react-query'
import type { Thread, Message } from '@chatai/types'

type ThreadDetail = {
  thread: Thread
  messages: Message[]
}

async function fetchThreadDetail(threadId: string): Promise<ThreadDetail> {
  const res = await fetch(`/api/threads/${threadId}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Gagal memuat pesan')
  return res.json() as Promise<ThreadDetail>
}

export function useThreadMessages(threadId: string | null) {
  return useQuery({
    queryKey: ['thread-messages', threadId],
    queryFn: () => fetchThreadDetail(threadId!),
    enabled: threadId !== null,
    staleTime: 1000 * 60 * 5,
  })
}
