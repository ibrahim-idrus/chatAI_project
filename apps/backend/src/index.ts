import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import type { Env } from './env'
import { authRoutes } from './routes/auth'
import { chatRoutes } from './routes/chat'
import { chatDoRoutes } from './routes/chat-do'
import { authMiddleware } from './middleware/auth'
import { handleRetry } from './lib/retry'
import type { DOStartPayload } from '@chatai/types'
import type { ExportedHandlerQueueHandler } from '@cloudflare/workers-types'

// Named export required by Cloudflare Workers runtime — DO classes must be
// named exports from the entry module, not inside the default export object.
export { ThreadChatDO } from './durable-objects/ThreadChatDO'

type Variables = {
  userId: string
  role: string
  sessionId: string
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.use(
  '/api/*',
  cors({
    origin: (origin) => {
      const allowed = ['http://localhost:5173', 'http://localhost:4173']
      return allowed.includes(origin) ? origin : 'http://localhost:5173'
    },  
    credentials: true,
  }),
)

app.use('/api/*', secureHeaders())

app.get('/health', (c) => c.json({ ok: true }))

// Auth routes — no auth middleware
app.route('/api/auth', authRoutes)

// Protected routes — require auth
app.use('/api/threads', authMiddleware)
app.use('/api/threads/*', authMiddleware)
app.use('/api/chat/*', authMiddleware)
app.use('/api/messages/*', authMiddleware)

// chatDoRoutes MUST be registered before chatRoutes.
// Hono matches the first registered route. chatDoRoutes handles POST /chat/stream;
// chatRoutes handles all other thread/message endpoints.
app.route('/api', chatDoRoutes)
app.route('/api', chatRoutes)

export default {
  fetch: app.fetch,
  queue: handleRetry as ExportedHandlerQueueHandler<Env, DOStartPayload>,
}
