const BASE_URL = '/api'

export type User = {
  id: string
  email: string
  displayName: string
  role: string
}

type ApiError = {
  error: string
  details?: Record<string, string[]>
}

// General fetcher — redirects to /login on 401
async function fetcher<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', 
    ...init,
  })
//klo gagal dia mengarahkan ke loginpage
  if (res.status === 401) {
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: res.statusText }))) as ApiError
    const err = Object.assign(new Error(body.error ?? res.statusText), {
      status: res.status,
      details: body.details,
    })
    throw err
  }

  return res.json() as Promise<T>
}

export function register(data: {
  email: string
  password: string
  displayName: string
}): Promise<{ message: string }> {
  return fetcher('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function login(data: {
  email: string
  password: string
}): Promise<{ message: string; user: User }> {
  return fetcher('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function logout(): Promise<{ message: string }> {
  return fetcher('/auth/logout', { method: 'POST' })
}

// getMe does NOT auto-redirect on 401 — used by root beforeLoad to hydrate auth
// Caller is responsible for handling the error
// get me mengirm request untuk meminta data user yg ada di session KV ke apps\backend\src\routes\auth.ts dan meminta menyertakan cookie yg dikirm
export async function getMe(): Promise<User> {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    credentials: 'include',
  })

  if (!res.ok) {
    const err = Object.assign(new Error('Unauthenticated'), { status: res.status })
    throw err
  }

  return res.json() as Promise<User>
}
