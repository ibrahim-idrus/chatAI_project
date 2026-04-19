import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { login, logout, getMe } from '../lib/api'
import { useAuthStore } from '../store/auth'

//logic awal login dimulai dan masuk ke dasboard chat 
export function useLogin() {
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: login,
    onSuccess: async (data) => {
      // Cancel any in-progress getMe fetches (retries from unauthenticated state)
      // before seeding the cache, so stale 401 responses can't override fresh data.
      await queryClient.cancelQueries({ queryKey: ['me'] })
      queryClient.setQueryData(['me'], data.user)
      setUser(data.user)
      navigate({ to: '/chat' })
    },
  })
}

// logic kalo dia logout
export function useLogout() {
  const clearUser = useAuthStore((s) => s.clearUser)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      clearUser()
      navigate({ to: '/login' })
    },
  })
}


// jika kita refresh app masih mengingat ktia klo kita sudah login
export function useMe() {
  const setUser = useAuthStore((s) => s.setUser)

  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const user = await getMe()
      setUser(user)
      return user
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
    throwOnError: false,
  })
}
