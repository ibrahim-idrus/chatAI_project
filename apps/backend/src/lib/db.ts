import { createClient } from '@chatai/db'
import type { Env } from '../env'

export function getDb(env: Env) {
  return createClient(env.DATABASE_URL)
}
