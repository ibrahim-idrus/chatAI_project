import { DurableObject } from 'cloudflare:workers'
import { streamText } from 'ai'
import type { Env } from '../env'
import type { DOStartPayload } from '@chatai/types'
import { getModel } from '../lib/stream'
import { completeMessage, markMessageFailed } from '../lib/chat-helpers'

export class ThreadChatDO extends DurableObject<Env> {
  private accumulated = ''
  private generating = false
  private writers = new Set<WritableStreamDefaultWriter<Uint8Array>>()

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/do/start') return this.handleStart(request)
    if (url.pathname === '/do/stream') return this.handleStream()
    return new Response('Not found', { status: 404 })
  }

  private async handleStart(request: Request): Promise<Response> {
    // Idempotent: second call while generating is a no-op
    if (this.generating) return new Response('already generating', { status: 200 })

    this.generating = true
    this.accumulated = ''

    const payload: DOStartPayload = await request.json()

    // this.ctx.waitUntil keeps the DO alive after this handler returns
    this.ctx.waitUntil(this.generate(payload))

    return new Response('started', { status: 200 })
  }

  private handleStream(): Response {
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
    const writer = writable.getWriter()
    this.writers.add(writer)

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  private async broadcast(chunk: string): Promise<void> {
    const encoded = new TextEncoder().encode(chunk)
    const dead: WritableStreamDefaultWriter<Uint8Array>[] = []

    for (const writer of this.writers) {
      try {
        await writer.write(encoded)
      } catch {
        // Client disconnected — mark for cleanup
        dead.push(writer)
      }
    }

    for (const writer of dead) {
      try { writer.abort() } catch { /* ignore */ }
      this.writers.delete(writer)
    }
  }

  private async generate(payload: DOStartPayload): Promise<void> {
    const { messageId, userId, threadId, messages } = payload

    try {
      const result = streamText({
        model: getModel(this.env),
        system: this.env.SYSTEM_PROMPT,
        messages,
      })

      // Iterate the text stream — each chunk is a raw string
      for await (const chunk of result.textStream) {
        this.accumulated += chunk
        await this.broadcast(chunk)
      }

      // result.usage resolves after textStream is fully consumed.
      // This version of the ai SDK uses inputTokens/outputTokens on LanguageModelUsage.
      const usage = await result.usage

      await completeMessage({
        env: this.env,
        messageId,
        threadId,
        userId,
        text: this.accumulated,
        promptTokens: usage.inputTokens ?? 0,
        completionTokens: usage.outputTokens ?? 0,
        totalTokens: usage.totalTokens ?? 0,
      })
    } catch (err) {
      console.error('[ThreadChatDO] generate failed:', err)
      await markMessageFailed(this.env, messageId)
      // Re-enqueue for retry — queue consumer will call /do/start again
      await this.env.CHAT_RETRY_QUEUE.send(payload)
    } finally {
      this.generating = false
      // Close all active writers (signals end-of-stream to connected clients)
      for (const writer of this.writers) {
        try { await writer.close() } catch { /* writer may already be closed */ }
      }
      this.writers.clear()
    }
  }
}
