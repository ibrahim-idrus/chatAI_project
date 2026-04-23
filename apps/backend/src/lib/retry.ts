import { eq } from 'drizzle-orm'
import { messages } from '@chatai/db'
import { getDb } from './db'
import type { Env } from '../env'
import type { DOStartPayload } from '@chatai/types'

export async function handleRetry(
  batch: MessageBatch<DOStartPayload>,
  env: Env,
): Promise<void> {
  for (const msg of batch.messages) {
    const payload = msg.body

    try {
      // Call DO directly — NOT through the Hono route.
      // The Hono route inserts DB records; the DO /do/start only runs generation.
      const doId = env.THREAD_CHAT_DO.idFromName(payload.threadId)
      const stub = env.THREAD_CHAT_DO.get(doId)

      await stub.fetch('http://do/do/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      // Queue consumer does not need to read the stream —
      // the DO updates the DB directly when generation completes.
      msg.ack()
    } catch (err) {
      console.error('[handleRetry] DO start failed for messageId:', payload.messageId, err)

      const attempts = msg.attempts ?? 0
      if (attempts >= 3) {
        try {
          await getDb(env)
            .update(messages)
            .set({ status: 'failed' })
            .where(eq(messages.id, payload.messageId))
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
