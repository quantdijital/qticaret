import type { IncomingMessage } from "node:http"

/**
 * What is left of a refused upload's body, read and dropped before the
 * refusal is sent (review of adr/0069 slice 1). Answering while the client
 * is still sending lets the server close the connection under it (Node
 * closes a `Connection: close` request once answered): the client's next
 * write meets a reset and it never reads the answer, so the panel shows a
 * network error instead of "too large".
 *
 * Bounded every way (security review B1, B4): never past `maxBytes` (a
 * body declared larger, or of unknown length, is not waited for), never
 * past `maxMs`, never for a client already gone, and at most
 * `MAX_CONCURRENT_DRAINS` at once in this process. Whoever is not drained
 * is answered at once with the connection closed after it. Whether a
 * request may be drained at all (only a signed-in person's) is the
 * caller's to decide.
 */

export const DRAIN_MAX_MS = 30_000
/** Drains running at once in this process; one more is answered without one. */
export const MAX_CONCURRENT_DRAINS = 4

export interface DrainLimits {
  maxBytes: number
  maxMs?: number
}

let active = 0

/** Drains running now (tests, logs). */
export const activeDrains = (): number => active

/** True once the body has been read to its end; false when it was not waited for. */
export function drainBody(req: IncomingMessage, limits: DrainLimits): Promise<boolean> {
  const maxMs = limits.maxMs ?? DRAIN_MAX_MS
  if (req.readableEnded || req.complete) {
    return Promise.resolve(true)
  }
  if (req.destroyed) {
    return Promise.resolve(false)
  }
  const declared = Number(req.headers["content-length"])
  if (!Number.isSafeInteger(declared) || declared < 0 || declared > limits.maxBytes) {
    return Promise.resolve(false)
  }
  if (active >= MAX_CONCURRENT_DRAINS) {
    return Promise.resolve(false)
  }
  active += 1
  return new Promise((resolve) => {
    let settled = false
    const finish = (ended: boolean) => {
      if (settled) {
        return
      }
      settled = true
      active -= 1
      clearTimeout(timer)
      req.off("end", onEnd)
      req.off("close", onClose)
      req.off("error", onClose)
      resolve(ended)
    }
    const onEnd = () => {
      finish(true)
    }
    const onClose = () => {
      finish(req.complete)
    }
    const timer = setTimeout(() => {
      finish(false)
    }, maxMs)
    timer.unref()
    req.on("end", onEnd)
    req.on("close", onClose)
    req.on("error", onClose)
    req.resume()
  })
}
