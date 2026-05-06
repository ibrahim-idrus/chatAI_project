import { z } from 'zod'

// ── Client → Server ──────────────────────────────────────

const sendMessageSchema = z.object({
  type: z.literal('send_message'),
  threadId: z.string(),
  content: z.string(),
})

const pingSchema = z.object({
  type: z.literal('ping'),
})

export const wsClientMessageSchema = z.discriminatedUnion('type', [
  sendMessageSchema,
  pingSchema,
])

export type WsClientMessage = z.infer<typeof wsClientMessageSchema>

// ── Server → Client ──────────────────────────────────────

const tokenSchema = z.object({
  type: z.literal('token'),
  content: z.string(),
})

const doneSchema = z.object({
  type: z.literal('done'),
  messageId: z.string(),
  tokenCount: z.number(),
})

const errorSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
})

const pongSchema = z.object({
  type: z.literal('pong'),
})

const statusSchema = z.object({
  type: z.literal('status'),
  status: z.string(),
})

export const wsServerMessageSchema = z.discriminatedUnion('type', [
  tokenSchema,
  doneSchema,
  errorSchema,
  pongSchema,
  statusSchema,
])

export type WsServerMessage = z.infer<typeof wsServerMessageSchema>

// ── Helpers ───────────────────────────────────────────────

export function parseWsClientMessage(data: string): WsClientMessage {
  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    throw new Error('Invalid JSON')
  }

  const result = wsClientMessageSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error(result.error.message)
  }

  return result.data
}

export function serializeWsServerMessage(msg: WsServerMessage): string {
  return JSON.stringify(msg)
}
