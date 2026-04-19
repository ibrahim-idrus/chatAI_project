import { create } from 'zustand'

type User = {
  id: string
  email: string
  displayName: string
  role: string
}

type AuthState = {
  user: User | null
  isLoading: boolean
  setUser: (user: User) => void
  clearUser: () => void 
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user, isLoading: false }),
  clearUser: () => set({ user: null, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
}))
