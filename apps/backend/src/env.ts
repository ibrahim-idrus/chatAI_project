export type Env = {
  DATABASE_URL: string
  JWT_SECRET: string
  OPENAI_API_KEY: string
  AI_MODEL: string
  AI_PROVIDER: string
  SYSTEM_PROMPT: string
  AI: Ai
  SESSION_KV: KVNamespace
  CHAT_RETRY_QUEUE: Queue
}
