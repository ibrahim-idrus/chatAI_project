import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  numeric,
  jsonb,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ─────────────────────────────────────────
// USERS
// ─────────────────────────────────────────
export const users = pgTable('users', {
  id:           uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email:        text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  displayName:  text('display_name').notNull(),
  role:         text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
})

// ─────────────────────────────────────────
// SESSIONS
// ─────────────────────────────────────────
export const sessions = pgTable('sessions', {
  id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId:      uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash:   text('token_hash').unique().notNull(),
  expiresAt:   timestamp('expires_at').notNull(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
})

// ─────────────────────────────────────────
// THREADS
// ─────────────────────────────────────────
export const threads = pgTable('threads', {
  id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId:      uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title:       text('title').notNull().default('New Thread'),
  totalTokens: integer('total_tokens').notNull().default(0),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
})

// ─────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────
export const messages = pgTable('messages', {
  id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  threadId:    uuid('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  role:        text('role', { enum: ['user', 'assistant'] }).notNull(),
  content:     text('content').notNull().default(''),
  tokenCount:  integer('token_count').notNull().default(0),
  status:      text('status', { enum: ['pending', 'completed', 'failed'] }).notNull().default('completed'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
})

// ─────────────────────────────────────────
// TOKEN USAGE
// ─────────────────────────────────────────
export const tokenUsage = pgTable('token_usage', {
  id:               uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId:           uuid('user_id').notNull().references(() => users.id),
  threadId:         uuid('thread_id').notNull().references(() => threads.id),
  messageId:        uuid('message_id').notNull().references(() => messages.id),
  promptTokens:     integer('prompt_tokens').notNull(),
  completionTokens: integer('completion_tokens').notNull(),
  totalTokens:      integer('total_tokens').notNull(),
  model:            text('model'),
  provider:         text('provider'),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
})

// ─────────────────────────────────────────
// EVENT LOGS
// ─────────────────────────────────────────
export const eventLogs = pgTable('event_logs', {
  id:        uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId:    uuid('user_id').references(() => users.id),  // nullable — untuk event pre-login
  eventType: text('event_type').notNull(),
  payload:   jsonb('payload'),
  ip:        text('ip'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})