import { Hono } from 'hono'
import {setCookie, deleteCookie } from 'hono/cookie'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { SignJWT } from 'jose'
import bcrypt from 'bcryptjs'
import { users, sessions } from '@chatai/db'
import type { Env } from '../env'
import { getDb } from '../lib/db'
import { logEvent } from '../lib/logger'
import { authMiddleware } from '../middleware/auth'

type Variables = {
  userId: string
  role: string
  sessionId: string
}
// buat isi form dan validasi apakah benar
const registerSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  displayName: z.string().min(2, 'Nama minimal 2 karakter'),
})
// buat isi form dan validasi apakah benar
const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
})

// expired token JWT dan Session selama 7 hari
const SESSION_TTL = 604800 // 7 days in seconds
const JWT_EXPIRY = '7d'

export const authRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

// POST /api/auth/register
// parsed(validasi) dari schemar register dan hasil pengecekan oleh zod
authRoutes.post('/register', async (c) => {
  const body = await c.req.json()
  const parsed = registerSchema.safeParse(body)

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors
    return c.json({ error: 'Validasi gagal', details: errors }, 400)
  }
// manggil db dari apps\backend\src\lib\db.ts
  const { email, password, displayName } = parsed.data
  const db = getDb(c.env)
// jika sudah ada email yg suda ada maka akan error pesan email sdah terdaftar
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (existing.length > 0) {
    return c.json({ error: 'Email sudah terdaftar' }, 409)
  }

  const passwordHash = await bcrypt.hash(password, 10)
// menginput form ke db dan pasword juga di hash
  await db.insert(users).values({
    email,
    passwordHash,
    displayName,
    role: 'user',
  })

  // // ngambil IP addres yg dikirm kan oleh claudflare jika tida ada berarti lewat proxy dan akan di simpan di db
  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? null
// log user yg sudah melakukan register
  logEvent(db, {
    eventType: 'user.register',
    payload: { email },
    ip: ip ?? undefined,
  })

  return c.json({ message: 'Register berhasil, silakan login' }, 201)
})

// POST /api/auth/login
authRoutes.post('/login', async (c) => {
  const body = await c.req.json()
  const parsed = loginSchema.safeParse(body)

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors
    return c.json({ error: 'Validasi gagal', details: errors }, 400)
  }

  const { email, password } = parsed.data
  const db = getDb(c.env)
  // ngambil IP addres yg dikirm kan oleh claudflare jika tida ada berarti lewat proxy
  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? null

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
    //ip address yg tdi di panggil oleh logevent dan tersimpan di db 
  if (!user) {
    logEvent(db, {
      eventType: 'user.login_failed',
      payload: { email },
      ip: ip ?? undefined,
    })
    return c.json({ error: 'Email atau password salah' }, 401)
  }
// membandingkan password yg di hash dengan pasword yg diketikkan
  const passwordMatch = await bcrypt.compare(password, user.passwordHash)

  if (!passwordMatch) {
    logEvent(db, {
      eventType: 'user.login_failed',
      payload: { email },
      ip: ip ?? undefined,
    })
    return c.json({ error: 'Email atau password salah' }, 401)
  }

  try {
    const sessionId = crypto.randomUUID()
    const secret = new TextEncoder().encode(c.env.JWT_SECRET)

    const jwt = await new SignJWT({ sub: user.id, sessionId, role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(JWT_EXPIRY)
      .setIssuedAt()
      .sign(secret)

    const expiresAt = new Date(Date.now() + SESSION_TTL * 1000)

    await c.env.SESSION_KV.put(
      sessionId,
      JSON.stringify({ userId: user.id, role: user.role, expiresAt: expiresAt.toISOString() }),
      { expirationTtl: SESSION_TTL },
    )

    // SHA-256 hash of sessionId for DB storage
    const hashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(sessionId),
    )
    // hasil dari hash dibuat jdi bisa disimpan ke db
    const tokenHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    await db.insert(sessions).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    })
// mengerim JWT ke browser sebagai cookie
    setCookie(c, 'token', jwt, {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      maxAge: SESSION_TTL,
      path: '/',
    })
// catat di db bahwa user berhasil login
    logEvent(db, {
      eventType: 'user.login',
      userId: user.id,
      payload: { email },
      ip: ip ?? undefined,
    })

    return c.json({
      message: 'Login berhasil',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    })
  } catch (err) {
    console.error('[login] session creation failed:', err)
    return c.json({ error: 'Gagal membuat sesi, coba lagi' }, 500)
  }
})

// POST /api/auth/logout  (requires auth)
authRoutes.post('/logout', authMiddleware, async (c) => {
  const sessionId = c.get('sessionId')
  const userId = c.get('userId')
  const db = getDb(c.env)

  await c.env.SESSION_KV.delete(sessionId)
  deleteCookie(c, 'token', { path: '/' })

  logEvent(db, {
    eventType: 'user.logout',
    userId,
  })

  return c.json({ message: 'Logout berhasil' })
})

// GET /api/auth/me  (requires auth) gunanya untuk memanggil getme yg ada di lib/api untuk menerima JWT dan cookie
authRoutes.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const db = getDb(c.env)

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) {
    return c.json({ error: 'User tidak ditemukan' }, 404)
  }

  return c.json(user)
})
