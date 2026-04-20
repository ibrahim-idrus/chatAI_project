import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { login, logout } from '../lib/api'
import { useAuthStore } from '../store/auth'

// Dipanggil saat user submit form login.
// Setelah berhasil: isi store + redirect ke /chat.
export function useLogin() {
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: login,
    onSuccess: async (data) => {
      // Batalkan fetch getMe yang sedang berjalan agar response 401 lama
      // tidak menimpa data user yang baru saja login.
      await queryClient.cancelQueries({ queryKey: ['me'] })
      queryClient.setQueryData(['me'], data.user)
      setUser(data.user)
      navigate({ to: '/chat' })
    },
  })
}

// Dipanggil saat user klik tombol logout.
// Setelah berhasil: kosongkan store + redirect ke /login.
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
