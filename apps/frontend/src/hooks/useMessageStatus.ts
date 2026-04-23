import { useQuery } from '@tanstack/react-query'

type MessageStatus = {
  id: string
  status: 'pending' | 'completed' | 'failed'
  content: string
}

async function fetchMessageStatus(messageId: string): Promise<MessageStatus> {
  const res = await fetch(`/api/messages/${messageId}/status`, {
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to fetch message status')
  return res.json() as Promise<MessageStatus>
}

export function useMessageStatus(messageId: string | null) {
  const query = useQuery<MessageStatus>({
    queryKey: ['message-status', messageId],
    queryFn: () => fetchMessageStatus(messageId!),
    enabled: messageId !== null,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 3000
      return data.status === 'pending' ? 3000 : false
    },
  })

  return {
    status: query.data?.status ?? null,
    content: query.data?.content ?? null,
    isPolling: query.data?.status === 'pending',
  }
}
