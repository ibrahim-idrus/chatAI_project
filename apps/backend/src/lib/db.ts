import { createDb } from '@chatai/db'
import type { Env } from '../env'

export function getDb(env: Env) {
  return createDb(env.DB)
}
