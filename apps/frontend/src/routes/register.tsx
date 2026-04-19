import { createFileRoute, redirect } from '@tanstack/react-router'
import { RegisterPage } from '../pages/RegisterPage'
import { useAuthStore } from '../store/auth'

export const Route = createFileRoute('/register')({
  beforeLoad: () => {
    const { user } = useAuthStore.getState()
    if (user) {
      throw redirect({ to: '/chat' })
    }
  },
  component: RegisterPage,
})
