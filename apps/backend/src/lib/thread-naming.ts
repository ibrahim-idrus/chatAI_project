import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { eq, asc } from 'drizzle-orm'
import { messages, threads } from '@chatai/db'
import type { Env } from '../env'
import { getDb } from '../lib/db'

export type ThreadNamingPayload = {
  threadId: string
  userId: string
}

export async function handleThreadNaming(
  batch: MessageBatch<ThreadNamingPayload>,
  env: Env,
): Promise<void> {
  for (const msg of batch.messages) {
    try {
      await generateThreadName(msg.body, env)
      msg.ack()
    } catch {
      msg.ack()
    }
  }
}

async function generateThreadName(payload: ThreadNamingPayload, env: Env) {
  const db = getDb(env)

  const [firstMsg] = await db
    .select({ content: messages.content })
    .from(messages)
    .where(eq(messages.threadId, payload.threadId))
    .orderBy(asc(messages.createdAt))
    .limit(1)

  if (!firstMsg) return

  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY })
  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    system: 'You generate short, descriptive thread titles (max 50 characters) based on the first user message. Respond with ONLY the title text, no quotes, no explanation.',
    prompt: firstMsg.content,
  })

  const title = text.trim().slice(0, 50)
  if (!title) return

  await db
    .update(threads)
    .set({ title, updatedAt: new Date() })
    .where(eq(threads.id, payload.threadId))

  const doId = env.CHAT_THREAD_DO.idFromName(payload.threadId)
  const stub = env.CHAT_THREAD_DO.get(doId)
  await stub.fetch(new Request('http://internal/rpc', {
    method: 'POST',
    body: JSON.stringify({ type: 'thread_name_updated', title }),
  }))
}
