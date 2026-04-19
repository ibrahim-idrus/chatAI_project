import type { DB } from '@chatai/db'
import { eventLogs } from '@chatai/db'

type LogEventParams = {
  eventType: string
  userId?: string
  payload?: Record<string, unknown>
  ip?: string
}

export function logEvent(db: DB, params: LogEventParams): void {
  const { eventType, userId, payload, ip } = params

  console.log(`[event] ${eventType}`, { userId, payload, ip })

  db.insert(eventLogs)
    .values({
      eventType,
      userId: userId ?? null,
      payload: payload ?? null,
      ip: ip ?? null,
    })
    .execute()
    .catch((err: unknown) => {
      console.error('[logEvent] failed to insert event_log:', err)
    })
}
