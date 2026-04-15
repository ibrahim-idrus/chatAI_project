import * as dotenv from 'dotenv'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import postgres from 'postgres'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env') })
dotenv.config({ path: resolve(__dirname, '../../../.env') })

const url = process.env.DATABASE_URL
if (!url) throw new Error('Missing DATABASE_URL')

const sql = postgres(url, { ssl: 'require' })

await sql`DROP TABLE IF EXISTS
  event_logs,
  token_usage,
  messages,
  sessions,
  threads,
  users
  CASCADE`

console.log('✓ Semua tabel berhasil di-drop')
await sql.end()
