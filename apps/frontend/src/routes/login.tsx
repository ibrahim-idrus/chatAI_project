import { createFileRoute, redirect } from '@tanstack/react-router'
import { LoginPage } from '../pages/LoginPage'
import { useAuthStore } from '../store/auth'

// cek apakah user udh login di zustand store, jika belum masih di menu login klo udh lagsung ke chat
export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    const { user } = useAuthStore.getState()
    if (user) {
      throw redirect({ to: '/chat' })
    }
  },
  component: LoginPage,
})
