import {
  pgTable, uuid, text, integer, numeric,
  timestamp, primaryKey
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

const timestamps = {
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}

export const orgs = pgTable('orgs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  systemPrompt: text('system_prompt'),
  aiProvider: text('ai_provider').notNull().default('openai'),
  aiModel: text('ai_model').notNull().default('gpt-4o'),
  aiTemperature: numeric('ai_temperature', { precision: 3, scale: 2 }).default('0.70'),
  ...timestamps,
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'member'] }).notNull().default('member'),
  displayName: text('display_name'),
  ...timestamps,
})

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').unique().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const threads = pgTable('threads', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('New Thread'),
  totalTokens: integer('total_tokens').notNull().default(0),
  deletedAt: timestamp('deleted_at'),
  ...timestamps,
})

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  threadId: uuid('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),
  tokenCount: integer('token_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const tokenUsage = pgTable('token_usage', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').notNull().references(() => orgs.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  threadId: uuid('thread_id').notNull().references(() => threads.id),
  messageId: uuid('message_id').notNull().references(() => messages.id),
  promptTokens: integer('prompt_tokens').notNull(),
  completionTokens: integer('completion_tokens').notNull(),
  totalTokens: integer('total_tokens').notNull(),
  provider: text('provider'),
  model: text('model'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const eventLogs = pgTable('event_logs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').notNull().references(() => orgs.id),
  userId: uuid('user_id').references(() => users.id),
  eventType: text('event_type').notNull(),
  payload: text('payload'), 
  createdAt: timestamp('created_at').defaultNow().notNull(),
})