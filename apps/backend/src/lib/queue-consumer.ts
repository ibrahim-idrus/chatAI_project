import { streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { eq, asc, sql } from 'drizzle-orm'
import { messages, threads, tokenUsage } from '@chatai/db'
import type { Env } from '../env'
import { getDb } from '../lib/db'
import { logEvent } from '../lib/logger'

export type QueueMessagePayload = {
  threadId: string
  userId: string
  messageId: string
  content: string
  model: string
  runNum: number
}

const MAX_RUNS = 3

export async function handleAiProcessing(
  batch: MessageBatch<QueueMessagePayload>,
  env: Env,
): Promise<void> {
  for (const msg of batch.messages) {
    try {
      await processAi(msg.body, env)
      msg.ack()
    } catch {
      if (msg.body.runNum < MAX_RUNS) {
        await env.AI_PROCESSING_QUEUE.send({ ...msg.body, runNum: msg.body.runNum + 1 })
      } else {
        const db = getDb(env)
        await db.update(messages)
          .set({ status: 'failed' })
          .where(eq(messages.id, msg.body.messageId))

        const doId = env.CHAT_THREAD_DO.idFromName(msg.body.threadId)
        const stub = env.CHAT_THREAD_DO.get(doId)
        await stub.fetch(new Request('http://internal/rpc', {
          method: 'POST',
          body: JSON.stringify({
            type: 'stream_error',
            message: 'Maaf, terjadi kesalahan. Coba lagi.',
          }),
        }))
      }
    }
  }
}

async function processAi(payload: QueueMessagePayload, env: Env) {
  const db = getDb(env)

  const history = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.threadId, payload.threadId))
    .orderBy(asc(messages.createdAt))

  const chatHistory = history.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY })
  const result = streamText({
    model: openai(env.AI_MODEL),
    system: env.SYSTEM_PROMPT,
    messages: chatHistory,
  })

  const doId = env.CHAT_THREAD_DO.idFromName(payload.threadId)
  const stub = env.CHAT_THREAD_DO.get(doId)
  const rpcUrl = `http://internal/rpc`

  let fullText = ''

  for await (const chunk of result.textStream) {
    fullText += chunk
    await stub.fetch(new Request(rpcUrl, {
      method: 'POST',
      body: JSON.stringify({
        type: 'stream_token',
        messageId: payload.messageId,
        token: chunk,
      }),
    }))
  }

  const usage = await result.usage
  const promptTokens = usage.inputTokens ?? 0
  const completionTokens = usage.outputTokens ?? 0
  const totalTokens = usage.totalTokens ?? 0

  await db.update(messages)
    .set({ content: fullText, status: 'completed', tokenCount: completionTokens })
    .where(eq(messages.id, payload.messageId))

  await db.insert(tokenUsage).values({
    userId: payload.userId,
    threadId: payload.threadId,
    messageId: payload.messageId,
    promptTokens,
    completionTokens,
    totalTokens,
    model: env.AI_MODEL,
    provider: env.AI_PROVIDER,
  })

  await db.update(threads)
    .set({ totalTokens: sql`${threads.totalTokens} + ${totalTokens}`, updatedAt: new Date() })
    .where(eq(threads.id, payload.threadId))

  logEvent(db, {
    eventType: 'message.completed',
    userId: payload.userId,
    payload: { threadId: payload.threadId, promptTokens, completionTokens, model: env.AI_MODEL },
  })

  await stub.fetch(new Request(rpcUrl, {
    method: 'POST',
    body: JSON.stringify({
      type: 'stream_complete',
      messageId: payload.messageId,
      tokenCount: completionTokens,
    }),
  }))
}
