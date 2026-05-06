import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import type { Env } from './env'
import { authRoutes } from './routes/auth'
import { threadRoutes } from './routes/threads'
import { authMiddleware } from './middleware/auth'
import { ChatThreadDO } from './durable-objects/ChatThreadDO'
import { handleAiProcessing } from './lib/queue-consumer'

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

app.route('/api/auth', authRoutes)

app.use('/api/threads', authMiddleware)
app.use('/api/threads/*', authMiddleware)
app.use('/api/messages/*', authMiddleware)

app.route('/api', threadRoutes)

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/chat/ws/')) {
      const threadId = url.pathname.split('/').pop()
      if (!threadId) return new Response('Bad Request', { status: 400 })

      const cookie = request.headers.get('cookie') ?? ''
      const token = cookie.split(';').find((c) => c.trim().startsWith('token='))?.split('=')[1]
      if (!token) return new Response('Unauthorized', { status: 401 })

      const doId = env.CHAT_THREAD_DO.idFromName(threadId)
      const stub = env.CHAT_THREAD_DO.get(doId)

      const doUrl = new URL(request.url)
      doUrl.pathname = '/ws'
      doUrl.searchParams.set('token', token)
      doUrl.searchParams.set('threadId', threadId)

      return stub.fetch(new Request(doUrl.toString(), {
        headers: request.headers,
        method: 'GET',
      }))
    }

    return app.fetch(request, env, ctx)
  },

  queue: handleAiProcessing,
}

export { ChatThreadDO }