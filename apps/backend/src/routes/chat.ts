import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, asc, desc, sql } from 'drizzle-orm'
import { threads, messages } from '@chatai/db'
import { getDb } from '../lib/db'
import { logEvent } from '../lib/logger'
import type { Env } from '../env'

type Variables = {
  userId: string
  role: string
  sessionId: string
}

export const chatRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

// ─── GET /api/threads ─────────────────────────────────────────────────────────
chatRoutes.get('/threads', async (c) => {
  const db = getDb(c.env)
  const userId = c.var.userId

  const pageParam = c.req.query('page')
  const limitParam = c.req.query('limit')

  if (!pageParam && !limitParam) {
    const rows = await db
      .select()
      .from(threads)
      .where(eq(threads.userId, userId))
      .orderBy(desc(threads.updatedAt))
    return c.json(rows)
  }

  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(limitParam ?? '20', 10)))
  const offset = (page - 1) * limit

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(threads)
      .where(eq(threads.userId, userId))
      .orderBy(desc(threads.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(threads)
      .where(eq(threads.userId, userId)),
  ])

  const total = countResult[0]?.count ?? 0

  return c.json({
    threads: rows,
    pagination: {
      page,
      limit,
      total,
      hasMore: offset + rows.length < total,
    },
  })
})

// ─── POST /api/threads ────────────────────────────────────────────────────────
chatRoutes.post('/threads', async (c) => {
  const db = getDb(c.env)
  const userId = c.var.userId

  const [thread] = await db
    .insert(threads)
    .values({ userId, title: 'New Thread' })
    .returning()

  logEvent(db, { eventType: 'thread.created', userId, payload: { threadId: thread.id } })

  return c.json(thread, 201)
})

// ─── GET /api/threads/:id ─────────────────────────────────────────────────────
chatRoutes.get('/threads/:id', async (c) => {
  const db = getDb(c.env)
  const userId = c.var.userId
  const threadId = c.req.param('id')

  const [thread] = await db
    .select()
    .from(threads)
    .where(and(eq(threads.id, threadId), eq(threads.userId, userId)))

  if (!thread) return c.json({ error: 'Thread not found' }, 404)

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.threadId, threadId))
    .orderBy(asc(messages.createdAt))

  return c.json({ thread, messages: msgs })
})

// ─── PATCH /api/threads/:id ───────────────────────────────────────────────────
chatRoutes.patch(
  '/threads/:id',
  zValidator('json', z.object({ title: z.string().min(1).max(100) })),
  async (c) => {
    const db = getDb(c.env)
    const userId = c.var.userId
    const threadId = c.req.param('id')
    const { title } = c.req.valid('json')

    const [existing] = await db
      .select({ id: threads.id })
      .from(threads)
      .where(and(eq(threads.id, threadId), eq(threads.userId, userId)))

    if (!existing) return c.json({ error: 'Thread not found' }, 404)

    const [updated] = await db
      .update(threads)
      .set({ title, updatedAt: new Date() })
      .where(eq(threads.id, threadId))
      .returning()

    return c.json(updated)
  },
)

// ─── DELETE /api/threads/:id ──────────────────────────────────────────────────
chatRoutes.delete('/threads/:id', async (c) => {
  const db = getDb(c.env)
  const userId = c.var.userId
  const threadId = c.req.param('id')

  const [thread] = await db
    .select()
    .from(threads)
    .where(and(eq(threads.id, threadId), eq(threads.userId, userId)))

  if (!thread) return c.json({ error: 'Thread not found' }, 404)

  logEvent(db, {
    eventType: 'thread.deleted',
    userId,
    payload: { threadId, title: thread.title },
  })

  await db.delete(threads).where(eq(threads.id, threadId))

  return c.json({ message: 'Thread deleted' })
})

// ─── GET /api/messages/:messageId/status ──────────────────────────────────────
chatRoutes.get('/messages/:messageId/status', async (c) => {
  const db = getDb(c.env)
  const userId = c.var.userId
  const messageId = c.req.param('messageId')

  const [row] = await db
    .select({
      id: messages.id,
      status: messages.status,
      content: messages.content,
    })
    .from(messages)
    .innerJoin(threads, eq(messages.threadId, threads.id))
    .where(and(eq(messages.id, messageId), eq(threads.userId, userId)))

  if (!row) return c.json({ error: 'Message not found' }, 404)

  return c.json(row)
})
