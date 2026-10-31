import type { ErrorTrackingDsn } from "./dsn"
import { eventOf } from "./event"
import type { EventContext, LogLine, TrackedEvent } from "./event"

/**
 * The logger's second destination (adr/0045): each line at error level or
 * above goes to GlitchTip as an event, as the logger wrote it (redacted).
 * Never in the request's way and never a cause of its own failures:
 * - sending is fire and forget, three seconds at most, no retry;
 * - the same failure in the same place is sent once a minute;
 * - at most `maxPending` sends wait; past that, events are dropped;
 * - its own failures are reported through `onFailure`, which logs below
 *   error level, so a GlitchTip that is down cannot feed itself.
 */

export interface ErrorTrackingOptions {
  dsn: ErrorTrackingDsn
  context: EventContext
  /** A send that failed: GlitchTip unreachable or refusing. */
  onFailure?: (reason: string) => void
  fetch?: typeof globalThis.fetch
  now?: () => number
  maxPending?: number
  repeatWindowMs?: number
  timeoutMs?: number
}

export interface ErrorTrackingStream {
  write: (line: string) => void
  /** Every send started so far, settled (tests and shutdown). */
  flush: () => Promise<void>
}

const OWN_EVENTS = "error_tracking."

export function envelopeOf(event: TrackedEvent, dsn: ErrorTrackingDsn, sentAt: string): string {
  const payload = JSON.stringify(event)
  return [
    JSON.stringify({ event_id: event.event_id, dsn: dsn.dsn, sent_at: sentAt }),
    JSON.stringify({
      type: "event",
      content_type: "application/json",
      length: Buffer.byteLength(payload),
    }),
    payload,
  ].join("\n")
}

export function createErrorTrackingStream(options: ErrorTrackingOptions): ErrorTrackingStream {
  const send = options.fetch ?? globalThis.fetch
  const now = options.now ?? Date.now
  const maxPending = options.maxPending ?? 20
  const repeatWindowMs = options.repeatWindowMs ?? 60_000
  const timeoutMs = options.timeoutMs ?? 3_000
  const lastSent = new Map<string, number>()
  const pending = new Set<Promise<void>>()

  const deliver = async (event: TrackedEvent): Promise<void> => {
    try {
      const response = await send(options.dsn.envelopeUrl, {
        method: "POST",
        headers: {
          "content-type": "application/x-sentry-envelope",
          "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${options.dsn.publicKey}, sentry_client=qticaret/1`,
        },
        body: envelopeOf(event, options.dsn, new Date(now()).toISOString()),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!response.ok) {
        options.onFailure?.(`http_${String(response.status)}`)
      }
    } catch (error) {
      options.onFailure?.(error instanceof Error ? error.name : "unknown")
    }
  }

  const write = (chunk: string): void => {
    let line: LogLine
    try {
      line = JSON.parse(chunk) as LogLine
    } catch {
      return
    }
    if (typeof line.event === "string" && line.event.startsWith(OWN_EVENTS)) {
      return
    }
    const event = eventOf(line, options.context)
    if (!event) {
      return
    }
    const key = event.fingerprint.join("|")
    const at = now()
    const last = lastSent.get(key)
    if (last !== undefined && at - last < repeatWindowMs) {
      return
    }
    if (pending.size >= maxPending) {
      return
    }
    lastSent.set(key, at)
    // Keys of failures long past are forgotten, so the map stays small
    if (lastSent.size > 1000) {
      for (const [seen, when] of lastSent) {
        if (at - when >= repeatWindowMs) {
          lastSent.delete(seen)
        }
      }
    }
    const sending = deliver(event).finally(() => pending.delete(sending))
    pending.add(sending)
  }

  return {
    write,
    flush: async () => {
      await Promise.allSettled([...pending])
    },
  }
}
