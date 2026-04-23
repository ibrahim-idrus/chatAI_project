import { eq, sql } from 'drizzle-orm'
import { messages, threads, tokenUsage } from '@chatai/db'
import { logEvent } from './logger'
import type { Env } from '../env'
import { getDb } from './db'

type CompleteMessageParams = {
  env: Env
  messageId: string
  threadId: string
  userId: string
  text: string
  promptTokens: number      // normalized name from result.usage.promptTokens
  completionTokens: number  // normalized name from result.usage.completionTokens
  totalTokens: number
}

export async function completeMessage(params: CompleteMessageParams): Promise<void> {
  const { env, messageId, threadId, userId, text, promptTokens, completionTokens, totalTokens } = params
  const db = getDb(env)

  await db
    .update(messages)
    .set({ content: text, status: 'completed', tokenCount: completionTokens })
    .where(eq(messages.id, messageId))

  await db.insert(tokenUsage).values({
    userId,
    threadId,
    messageId,
    promptTokens,
    completionTokens,
    totalTokens,
    model: env.AI_MODEL,
    provider: env.AI_PROVIDER,
  })

  await db
    .update(threads)
    .set({
      totalTokens: sql`${threads.totalTokens} + ${totalTokens}`,
      updatedAt: new Date(),
    })
    .where(eq(threads.id, threadId))

  logEvent(db, {
    eventType: 'message.completed',
    userId,
    payload: { threadId, promptTokens, completionTokens, model: env.AI_MODEL },
  })
}

export async function markMessageFailed(env: Env, messageId: string): Promise<void> {
  const db = getDb(env)
  await db
    .update(messages)
    .set({ status: 'failed' })
    .where(eq(messages.id, messageId))
}
