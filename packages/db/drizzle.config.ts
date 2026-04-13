import { defineConfig } from 'drizzle-kit'
import * as dotenv from 'dotenv'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Allow local override (packages/db/.env), then fallback to repo root (.env)
dotenv.config({ path: resolve(__dirname, '.env') })
dotenv.config({ path: resolve(__dirname, '../../.env') })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error(
    'Missing DATABASE_URL. Set it in the environment or create a .env file (repo root: .env, or packages/db/.env).',
  )
}

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
})
