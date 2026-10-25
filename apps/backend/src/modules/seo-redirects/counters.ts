import { errorSummary, logger } from "../../lib/logging"

export interface CounterRow {
  key: string
  count: number
  last: Date
  /** The last non-null detail added for the key (a 404's referer host). */
  detail: string | null
}

export interface CounterBufferOptions {
  name: string
  write: (rows: CounterRow[]) => Promise<void>
  /** Written once the oldest count is this old (on the next add) or on `flush`. */
  everyMs: number
  /** Keys held at most; more are written at once, and a flood beyond that is dropped. */
  maxKeys: number
  now?: () => number
}

/**
 * Counts held in memory and written in one statement (adr/0017): a hit
 * counter or a 404 log must not turn every public request into a write.
 * Counts wait at most `everyMs`, written by a timer when no request comes.
 * Counts are approximate by design: a process that stops loses what it
 * held, a failed write is logged and dropped, and while a write is in
 * flight new keys beyond `maxKeys` are dropped. Writes run one after
 * another, so `flush` resolves once everything added before it is written.
 */
export function createCounterBuffer({
  name,
  write,
  everyMs,
  maxKeys,
  now = Date.now,
}: CounterBufferOptions) {
  let rows = new Map<string, CounterRow>()
  let startedAt: number | null = null
  let dropped = 0
  // A write in flight: counts wait (up to maxKeys) instead of queueing
  // another, so a stalled database cannot pile batches up in memory
  let writing = false
  let tail: Promise<void> = Promise.resolve()
  // A quiet shop sends no next request to write the counts it holds
  let timer: ReturnType<typeof setTimeout> | null = null

  function flush(): Promise<void> {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    const batch = [...rows.values()]
    rows = new Map()
    startedAt = null
    if (dropped > 0) {
      logger.warn({ event: `${name}.dropped`, count: dropped })
      dropped = 0
    }
    if (batch.length > 0) {
      writing = true
      tail = tail
        .then(() => write(batch))
        .catch((error: unknown) => {
          logger.warn({
            event: `${name}.write_failed`,
            err: errorSummary(error),
            rows: batch.length,
          })
        })
        .finally(() => {
          writing = false
        })
    }
    return tail
  }

  function add(key: string, detail: string | null = null): void {
    const row = rows.get(key)
    const at = new Date(now())
    if (row) {
      row.count += 1
      row.last = at
      row.detail = detail ?? row.detail
    } else if (rows.size < maxKeys) {
      rows.set(key, { key, count: 1, last: at, detail })
    } else {
      dropped += 1
    }
    if (startedAt === null) {
      startedAt = now()
      // unref: a pending write never keeps a process from exiting
      timer = setTimeout(() => void flush(), everyMs)
      timer.unref()
    }
    if (!writing && (rows.size >= maxKeys || now() - startedAt >= everyMs)) {
      void flush()
    }
  }

  return { add, flush }
}

export type CounterBuffer = ReturnType<typeof createCounterBuffer>
