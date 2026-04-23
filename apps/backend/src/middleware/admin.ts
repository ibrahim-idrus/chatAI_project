import { createMiddleware } from 'hono/factory'
import type { Env } from '../env'

type Variables = {
  userId: string
  role: string
  sessionId: string
}

export const adminMiddleware = createMiddleware<{
  Bindings: Env
  Variables: Variables
}>(async (c, next) => {
  const role = c.get('role')
  if (role !== 'admin') {
    return c.json({ error: 'Forbidden: admin only' }, 403)
  }
  await next()
})
