import { DurableObject } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { messages } from '@chatai/db'
import type { Env } from '../env'
import { parseWsClientMessage, serializeWsServerMessage } from '../lib/ws-protocol'
import { validateSession } from '../lib/session'
import { getDb } from '../lib/db'
import { logEvent } from '../lib/logger'
import type { QueueMessagePayload } from '../lib/queue-consumer'

export class ChatThreadDO extends DurableObject<Env> {
  private threadId: string
  private userId: string | null
  private sessionId: string | null
  private connections: Set<WebSocket>
  private currentMessageId: string | null

  constructor(state: DurableObjectState, env: Env) {
    super(state, env)
    this.threadId = ''
    this.userId = null
    this.sessionId = null
    this.connections = new Set()
    this.currentMessageId = null

    state.blockConcurrencyWhile(async () => {
      const storedThreadId = await state.storage.get<string>('threadId')
      if (storedThreadId) {
        this.threadId = storedThreadId
      }

      const storedUserId = await state.storage.get<string>('userId')
      if (storedUserId) {
        this.userId = storedUserId
      }

      const storedSessionId = await state.storage.get<string>('sessionId')
      if (storedSessionId) {
        this.sessionId = storedSessionId
      }

      const storedMessageId = await state.storage.get<string>('currentMessageId')
      if (storedMessageId) {
        this.currentMessageId = storedMessageId
      }
    })
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.endsWith('/ws')) {
      const token = url.searchParams.get('token')
      const threadId = url.searchParams.get('threadId')
      if (!token) {
        return new Response('Unauthorized', { status: 401 })
      }

      const session = await validateSession(token, this.env)
      if (!session) {
        return new Response('Unauthorized', { status: 401 })
      }

      if (threadId && !this.threadId) {
        this.threadId = threadId
        await this.ctx.storage.put('threadId', threadId)
      }

      if (!this.userId) {
        this.userId = session.userId
        await this.ctx.storage.put('userId', session.userId)
      }

      if (!this.sessionId) {
        this.sessionId = session.sessionId
        await this.ctx.storage.put('sessionId', session.sessionId)
      }

      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)
      this.ctx.acceptWebSocket(server)
      this.connections.add(server)
      return new Response(null, { status: 101, webSocket: client })
    }

    if (url.pathname.endsWith('/rpc')) {
      const body = await request.json()
      return this.handleRpc(body)
    }

    return new Response('Not found', { status: 404 })
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    const data = typeof message === 'string' ? message : new TextDecoder().decode(message)
    try {
      const msg = parseWsClientMessage(data)
      if (msg.type === 'ping') {
        ws.send(serializeWsServerMessage({ type: 'pong' }))
      } else if (msg.type === 'send_message') {
        if (msg.threadId !== this.threadId) {
          ws.send(serializeWsServerMessage({ type: 'error', message: 'Thread ID mismatch' }))
          return
        }
        await this.processMessage(msg)
      }
    } catch {
      ws.send(serializeWsServerMessage({ type: 'error', message: 'Invalid message format' }))
    }
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string) {
    this.connections.delete(ws)
  }

  async webSocketError(ws: WebSocket, _error: unknown) {
    this.connections.delete(ws)
  }

  private async processMessage(msg: { threadId: string; content: string }) {
    const db = getDb(this.env)
    const userId = this.userId
    if (!userId) {
      return
    }

    const [userMsg] = await db.insert(messages).values({
      threadId: msg.threadId,
      role: 'user',
      content: msg.content,
      tokenCount: msg.content.length,
      status: 'completed',
    }).returning()

    logEvent(db, {
      eventType: 'message.sent',
      userId,
      payload: { threadId: msg.threadId, messageId: userMsg.id },
    })

    const [assistantMsg] = await db.insert(messages).values({
      threadId: msg.threadId,
      role: 'assistant',
      content: '',
      status: 'pending',
      tokenCount: 0,
    }).returning()

    this.currentMessageId = assistantMsg.id
    await this.ctx.storage.put('currentMessageId', assistantMsg.id)

    this.broadcastStatus('processing')

    await this.sendToQueue({
      threadId: msg.threadId,
      userId,
      messageId: assistantMsg.id,
      content: msg.content,
      model: this.env.AI_MODEL,
      runNum: 1,
    })
  }

  private async sendToQueue(payload: QueueMessagePayload) {
    try {
      await this.env.AI_PROCESSING_QUEUE.send(payload)
    } catch {
      try {
        const db = getDb(this.env)
        await db.update(messages)
          .set({ status: 'failed' })
          .where(eq(messages.id, payload.messageId))
      } catch {
        // best effort
      }
      this.broadcastError('Maaf, terjadi kesalahan. Coba lagi.')
    }
  }

  private async handleRpc(body: unknown): Promise<Response> {
    const rpc = body as Record<string, unknown>
    const type = rpc.type

    if (type === 'stream_token') {
      const token = rpc.token as string
      if (token) {
        this.broadcastToken(token)
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    if (type === 'stream_complete') {
      const messageId = rpc.messageId as string
      const tokenCount = rpc.tokenCount as number
      this.broadcastDone(messageId, tokenCount)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    if (type === 'stream_error') {
      const message = rpc.message as string
      this.broadcastError(message ?? 'Maaf, terjadi kesalahan. Coba lagi.')
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    if (type === 'get_status') {
      return new Response(JSON.stringify({
        threadId: this.threadId,
        userId: this.userId,
        connections: this.connections.size,
        currentMessageId: this.currentMessageId,
      }), { status: 200 })
    }

    if (type === 'validate_session') {
      if (this.sessionId) {
        const session = await this.env.SESSION_KV.get(this.sessionId)
        if (!session) {
          for (const ws of this.connections) {
            ws.close(4001, 'Session expired')
          }
          this.connections.clear()
        }
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    return new Response(JSON.stringify({ error: 'Invalid RPC type' }), { status: 400 })
  }

  protected broadcastToken(token: string) {
    if (this.connections.size === 0) {
      return
    }
    const msg = serializeWsServerMessage({ type: 'token', content: token })
    for (const ws of this.connections) {
      if (ws.readyState !== 1) continue
      try {
        ws.send(msg)
      } catch {
        this.connections.delete(ws)
      }
    }
  }

  protected broadcastDone(messageId: string, tokenCount: number) {
    const msg = serializeWsServerMessage({ type: 'done', messageId, tokenCount })
    for (const ws of this.connections) {
      if (ws.readyState !== 1) continue
      try {
        ws.send(msg)
      } catch {
        this.connections.delete(ws)
      }
    }
  }

  protected broadcastError(message: string) {
    const msg = serializeWsServerMessage({ type: 'error', message })
    for (const ws of this.connections) {
      if (ws.readyState !== 1) continue
      try {
        ws.send(msg)
      } catch {
        this.connections.delete(ws)
      }
    }
  }

  protected broadcastStatus(status: string) {
    const msg = serializeWsServerMessage({ type: 'status', status })
    for (const ws of this.connections) {
      if (ws.readyState !== 1) continue
      try {
        ws.send(msg)
      } catch {
        this.connections.delete(ws)
      }
    }
  }

  getCurrentMessageId(): string | null {
    return this.currentMessageId
  }
}
