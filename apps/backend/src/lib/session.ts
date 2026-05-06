import { jwtVerify } from 'jose'
import { eq } from 'drizzle-orm'
import { sessions } from '@chatai/db'
import type { Env } from '../env'
import { getDb } from './db'

async function hashSessionId(sessionId: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(sessionId),
  )
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function validateSession(
  token: string,
  env: Env,
): Promise<{ userId: string; role: string; sessionId: string } | null> {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    const { sub, role, sessionId } = payload as {
      sub: string
      role: string
      sessionId: string
    }

    if (!sub || !role || !sessionId) {
      return null
    }

    const session = await env.SESSION_KV.get(sessionId)
    if (!session) {
      return null
    }

    const db = getDb(env)
    const tokenHash = await hashSessionId(sessionId)
    const [dbSession] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1)

    if (!dbSession) {
      return null
    }

    return { userId: sub, role, sessionId }
  } catch {
    return null
  }
}
