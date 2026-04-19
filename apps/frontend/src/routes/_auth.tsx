import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { useAuthStore } from '../store/auth'

export const Route = createFileRoute('/_auth')({
  beforeLoad: () => {
    const { user } = useAuthStore.getState()
    if (!user) {
      throw redirect({ to: '/login' })
    }
  },
  component: () => <Outlet />,
})
