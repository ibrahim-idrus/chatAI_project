import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '../store/auth'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    const { user } = useAuthStore.getState()
    throw redirect({ to: user ? '/chat' : '/login' })
  },
  component: () => null,
})
