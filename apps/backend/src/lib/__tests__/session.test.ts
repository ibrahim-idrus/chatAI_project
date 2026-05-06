import { describe, it, expect, mock, beforeAll, beforeEach } from 'bun:test'
import { Hono } from 'hono'

const mockPayload = { sub: 'user-123', role: 'user', sessionId: 'session-456' }
const mockJwtVerify = mock(() => Promise.resolve({ payload: mockPayload }))
const mockKvGet = mock((_key: string) => Promise.resolve(JSON.stringify({ userId: 'user-123', role: 'user' })))

const mockDbChain = {
  select: mock(() => mockDbChain),
  from: mock(() => mockDbChain),
  where: mock(() => mockDbChain),
  limit: mock(() => Promise.resolve([{ id: 'db-session-uuid' }])),
}

const mockGetDb = mock(() => mockDbChain)

// mock.module must run before dynamic import
mock.module('jose', () => ({ jwtVerify: mockJwtVerify }))
mock.module('@chatai/db', () => ({
  sessions: { id: 'sessions.id' },
  createClient: mock(() => {}),
}))
mock.module('../db', () => ({ getDb: mockGetDb }))

let validateSession: (token: string, env: unknown) => Promise<{ userId: string; role: string; sessionId: string } | null>
let authMiddleware: ReturnType<typeof import('hono/factory')['createMiddleware']>

beforeAll(async () => {
  const s = await import('../session')
  const a = await import('../../middleware/auth')
  validateSession = s.validateSession
  authMiddleware = a.authMiddleware
})

const mockEnv = {
  JWT_SECRET: 'test-secret-key',
  SESSION_KV: { get: mockKvGet },
  DATABASE_URL: 'postgres://test',
}

beforeEach(() => {
  mockJwtVerify.mockReset()
  mockKvGet.mockReset()
  mockGetDb.mockReset()
  mockJwtVerify.mockImplementation(() => Promise.resolve({ payload: mockPayload }))
  mockKvGet.mockImplementation((_key: string) => Promise.resolve(JSON.stringify({ userId: 'user-123', role: 'user' })))
  mockGetDb.mockImplementation(() => mockDbChain)
})

describe('validateSession', () => {
  it('returns userId, role, sessionId for a valid session', async () => {
    const result = await validateSession('valid-token', mockEnv as never)

    expect(result).toEqual({ userId: 'user-123', role: 'user', sessionId: 'session-456' })
    expect(mockJwtVerify).toHaveBeenCalled()
    expect(mockKvGet).toHaveBeenCalledWith('session-456')
    expect(mockGetDb).toHaveBeenCalled()
  })

  it('returns null when JWT verification fails', async () => {
    mockJwtVerify.mockImplementation(() => Promise.reject(new Error('invalid signature')))

    const result = await validateSession('bad-token', mockEnv as never)

    expect(result).toBeNull()
  })

  it('returns null when KV session is missing', async () => {
    mockKvGet.mockImplementation((_key: string) => Promise.resolve(null))

    const result = await validateSession('valid-token', mockEnv as never)

    expect(result).toBeNull()
    expect(mockKvGet).toHaveBeenCalledWith('session-456')
  })
})

describe('authMiddleware', () => {
  type Variables = {
    userId: string
    role: string
    sessionId: string
  }

  it('returns 401 when cookie is missing', async () => {
    const app = new Hono<{ Bindings: typeof mockEnv; Variables: Variables }>()
    app.use('/protected', authMiddleware)
    app.get('/protected', (c) => c.json({ ok: true }))

    const res = await app.request('/protected')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: 'Session expired, silakan login ulang' })
  })

  it('sets userId, role, sessionId on success', async () => {
    const app = new Hono<{ Bindings: typeof mockEnv; Variables: Variables }>()
    app.use('/protected', authMiddleware)
    app.get('/protected', (c) => {
      return c.json({ userId: c.get('userId'), role: c.get('role'), sessionId: c.get('sessionId') })
    })

    const res = await app.request(
      '/protected',
      { headers: { cookie: 'token=valid-token' } },
      mockEnv,
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ userId: 'user-123', role: 'user', sessionId: 'session-456' })
  })
})
