import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, and, asc } from 'drizzle-orm'
import { messages, threads } from '@chatai/db'
import { SendMessageSchema } from '@chatai/types'
import type { DOStartPayload } from '@chatai/types'
import { getDb } from '../lib/db'
import { logEvent } from '../lib/logger'
import type { Env } from '../env'

type Variables = { userId: string; role: string; sessionId: string }

export const chatDoRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

chatDoRoutes.post(
  '/chat/stream',
  zValidator('json', SendMessageSchema),
  async (c) => {
    const db = getDb(c.env)
    const userId = c.var.userId
    const { threadId, content } = c.req.valid('json')

    // Verify thread ownership
    const [thread] = await db
      .select({ id: threads.id })
      .from(threads)
      .where(and(eq(threads.id, threadId!), eq(threads.userId, userId)))

    if (!thread) return c.json({ error: 'Thread not found' }, 404)

    // Insert user message (completed immediately)
    const [userMsg] = await db
      .insert(messages)
      .values({
        threadId: threadId!,
        role: 'user',
        content,
        tokenCount: content.length,
        status: 'completed',
      })
      .returning()

    logEvent(db, {
      eventType: 'message.sent',
      userId,
      payload: { threadId, messageId: userMsg.id },
    })

    // Insert placeholder assistant message (pending — DO will update it on finish)
    const [assistantMsg] = await db
      .insert(messages)
      .values({ threadId: threadId!, role: 'assistant', content: '', status: 'pending', tokenCount: 0 })
      .returning()

    // Fetch completed message history for the AI context
    const history = await db
      .select({ role: messages.role, content: messages.content })
      .from(messages)
      .where(and(eq(messages.threadId, threadId!), eq(messages.status, 'completed')))
      .orderBy(asc(messages.createdAt))

    const chatMessages = history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    const payload: DOStartPayload = {
      messageId: assistantMsg.id,
      userId,
      threadId: threadId!,
      messages: chatMessages,
    }

    // Get DO stub keyed by threadId — one DO instance per thread
    const doId = c.env.THREAD_CHAT_DO.idFromName(threadId!)
    const stub = c.env.THREAD_CHAT_DO.get(doId)

    try {
      // MUST await /do/start before opening /do/stream.
      // The DO registers ctx.waitUntil(generate()) inside handleStart.
      // If /do/stream is called before /do/start returns, generate() may not be running yet.
      await stub.fetch('http://do/do/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      // Pipe the DO's raw text stream directly to the HTTP client.
      // TextStreamChatTransport on the frontend reads this as a plain text stream.
      return stub.fetch('http://do/do/stream')
    } catch (err) {
      console.error('[POST /chat/stream] DO call failed:', err)

      // Fallback: enqueue for retry — DO will be re-triggered by queue consumer
      await c.env.CHAT_RETRY_QUEUE.send(payload)

      return c.json({ error: 'Gagal generate response' }, 503)
    }
  },
)
