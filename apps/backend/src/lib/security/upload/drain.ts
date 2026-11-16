import type { IncomingMessage } from "node:http"

/**
 * What is left of a refused upload's body, read and dropped before the
 * refusal is sent (review of adr/0069 slice 1). Answering while the client
 * is still sending lets the server close the connection under it (Node
 * closes a `Connection: close` request once answered): the client's next
 * write meets a reset and it never reads the answer, so the panel shows a
 * network error instead of "too large". Draining is bounded: a body
 * declared past `maxBytes`, of unknown length, or not done in `maxMs` is
 * not waited for (the answer then goes with the connection closed after it).
 */

export const DRAIN_MAX_BYTES = 64 * 1024 * 1024
export const DRAIN_MAX_MS = 30_000

export interface DrainLimits {
  maxBytes?: number
  maxMs?: number
}

/** True once the body has been read to its end; false when it was not waited for. */
export function drainBody(req: IncomingMessage, limits: DrainLimits = {}): Promise<boolean> {
  const maxBytes = limits.maxBytes ?? DRAIN_MAX_BYTES
  const maxMs = limits.maxMs ?? DRAIN_MAX_MS
  if (req.readableEnded || req.complete) {
    return Promise.resolve(true)
  }
  const declared = Number(req.headers["content-length"])
  if (!Number.isSafeInteger(declared) || declared < 0 || declared > maxBytes) {
    return Promise.resolve(false)
  }
  return new Promise((resolve) => {
    let settled = false
    const finish = (ended: boolean) => {
      if (settled) {
        return
      }
      settled = true
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
