import { z } from 'zod'
// hanya user dengan role ini yg dapat menggunakan AI chat
export const MessageRoleSchema = z.enum(['user', 'assistant', 'system'])
export type MessageRole = z.infer<typeof MessageRoleSchema>

export const MessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  role: MessageRoleSchema,
  content: z.string(),
  tokenCount: z.number().default(0),
  status: z.enum(['pending', 'completed', 'failed']).default('completed'),
  createdAt: z.date(),
})
export type Message = z.infer<typeof MessageSchema>

export const ThreadSchema = z.object({
  id: z.string(),
  title: z.string(),
  totalTokens: z.number().default(0),
  deletedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})
export type Thread = z.infer<typeof ThreadSchema>

// Dipakai oleh React Hook Form di chat input
export const SendMessageSchema = z.object({
  content: z.string().min(1, 'Pesan tidak boleh kosong').max(10_000),
  threadId: z.string().optional(),
})
export type SendMessageInput = z.infer<typeof SendMessageSchema>

export type DOStartPayload = {
  messageId: string
  userId: string
  threadId: string
  messages: { role: 'user' | 'assistant'; content: string }[]
}
