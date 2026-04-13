import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Env } from './env'
import { chatRoutes } from './routes/chat'

const app = new Hono<{ Bindings: Env }>()

app.use('*', logger())
app.use('/api/*', cors())

app.get('/', (c) => c.json({ ok: true, service: 'chatai-backend' }))

app.route('/api/chat', chatRoutes)

export default app
