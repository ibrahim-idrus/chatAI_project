import { Hono } from 'hono'
import type { Env } from '../env'

export const chatRoutes = new Hono<{ Bindings: Env }>()

chatRoutes.get('/', (c) => {
  return c.json({ conversations: [] })
})
