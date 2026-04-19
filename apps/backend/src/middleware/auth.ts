import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { jwtVerify } from 'jose'
import type { Env } from '../env'

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

  let payload: { sub: string; role: string; sessionId: string }
// validasi JWT jika sudah melewati batas waktu makan harus login ulang
  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET)
    const { payload: p } = await jwtVerify(token, secret)
    payload = p as typeof payload
  } catch {
    return c.json({ error: 'Session expired, silakan login ulang' }, 401)
  }

  const { sub, role, sessionId } = payload

  if (!sub || !role || !sessionId) {
    return c.json({ error: 'Session expired, silakan login ulang' }, 401)
  }
// cek session di kv jika sudah expaired(sama seperti JWT) maka login ulang
  const session = await c.env.SESSION_KV.get(sessionId)
  if (!session) {
    return c.json({ error: 'Session expired, silakan login ulang' }, 401)
  }

  c.set('userId', sub)
  c.set('role', role)
  c.set('sessionId', sessionId)

  await next()
})
