import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import type { Env } from '../env'
import { validateSession } from '../lib/session'

type Variables = {
  userId: string
  role: string
  sessionId: string
}

export const authMiddleware = createMiddleware<{
  Bindings: Env
  Variables: Variables
}>(async (c, next) => {
  const token = getCookie(c, 'token')

  if (!token) {
    return c.json({ error: 'Session expired, silakan login ulang' }, 401)
  }

  const session = await validateSession(token, c.env)
  if (!session) {
    return c.json({ error: 'Session expired, silakan login ulang' }, 401)
  }

  c.set('userId', session.userId)
  c.set('role', session.role)
  c.set('sessionId', session.sessionId)

  await next()
})
