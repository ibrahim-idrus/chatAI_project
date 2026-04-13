import { z } from 'zod'

export const MessageRoleSchema = z.enum(['user', 'assistant'])
export type MessageRole = z.infer<typeof MessageRoleSchema>

export const MessageSchema = z.object({
  id: z.string(),
  role: MessageRoleSchema,
  content: z.string(),
  conversationId: z.string(),
  createdAt: z.date(),
})
export type Message = z.infer<typeof MessageSchema>

export const ConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})
export type Conversation = z.infer<typeof ConversationSchema>

export const SendMessageSchema = z.object({
  content: z.string().min(1).max(10_000),
  conversationId: z.string().optional(),
})
export type SendMessageInput = z.infer<typeof SendMessageSchema>
