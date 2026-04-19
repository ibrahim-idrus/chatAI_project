import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { getMe } from '../lib/api'
import { useAuthStore } from '../store/auth'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context }) => {
    try {
      const user = await context.queryClient.fetchQuery({
        queryKey: ['me'],
        queryFn: getMe,
        staleTime: 5 * 60 * 1000,
        retry: false, // prevent retries from racing with login
      })
      useAuthStore.getState().setUser(user)
    } catch {
      useAuthStore.getState().clearUser()
    }
  },
  component: () => <Outlet />,
})
