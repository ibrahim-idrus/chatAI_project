import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { eq, sql } from 'drizzle-orm'
import { messages, threads, tokenUsage } from '@chatai/db'
import { getDb } from './db'
import { logEvent } from './logger'
import type { Env } from '../env'

export type RetryPayload = {
  userId: string
  threadId: string
  messageId: string
  messages: { role: 'user' | 'assistant'; content: string }[]
}

export async function handleRetry(
  batch: MessageBatch<RetryPayload>,
  env: Env,
): Promise<void> {
  for (const msg of batch.messages) {
    const { userId, threadId, messageId, messages: history } = msg.body
    const db = getDb(env)

    try {
      const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY })

      const { text, usage } = await generateText({
        model: openai(env.AI_MODEL),
        system: env.SYSTEM_PROMPT,
        messages: history,
      })

      const promptTokens = usage.inputTokens ?? 0
      const completionTokens = usage.outputTokens ?? 0
      const totalTokens = usage.totalTokens ?? 0

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
        .set({ totalTokens: sql`${threads.totalTokens} + ${totalTokens}` })
        .where(eq(threads.id, threadId))

      logEvent(db, {
        eventType: 'message.completed',
        userId,
        payload: { threadId, retried: true, promptTokens, completionTokens },
      })

      msg.ack()
    } catch (err) {
      console.error('[handleRetry] failed for messageId:', messageId, err)

      const attempts = msg.attempts ?? 0
      if (attempts >= 3) {
        try {
          await getDb(env)
            .update(messages)
            .set({ status: 'failed' })
            .where(eq(messages.id, messageId))
        } catch (dbErr) {
          console.error('[handleRetry] failed to mark message as failed:', dbErr)
        }
        msg.ack()
      } else {
        msg.retry()
      }
    }
  }
}
