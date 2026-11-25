import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { precheckSignedRequest } from "@qticaret/server-kit"
import { AI_CALL_RESPONSE_HEADERS, AI_GATEWAY_REFUSALS } from "@qticaret/types/control-plane"
import { holdBodyRead } from "../../lib/ai-gateway/body-reads"
import { AI_GATEWAY_BODY_TIMEOUT_MS } from "../../lib/ai-gateway/limits"
import { matchTenantApi } from "../../lib/fleet/tenant-api-routes"
import { ensureRequestId, rejectRequest, routePath } from "./request"

/**
 * A raw body route's bytes (`rawBody` in the tenant API table: the AI
 * gateway's call), read before the signature guard: the body parsers are
 * off for it (`bodyParser: false`), so a JSON body and a form alike are
 * kept exactly as sent and parsed by nothing before the signature over
 * them is checked. Before a byte is read (security review of P3b O2): the
 * signature's headers must be there, well formed and on time (else the
 * guard's own 401), and a declared length within the route's size (else
 * 413), and a slot among the process's 16 bodies read at once (security
 * review N2, body-reads.ts; else 503 `unavailable`, the body never kept).
 * A stream past the size is cut and refused (413, the gateway's own
 * refusal, its strict envelope); one slower than 30 s is answered 408 and
 * its connection closed. Any other request passes untouched: the limit is
 * the call's alone, the one route whose body may be 6 MB.
 */

const rawBodies = new WeakMap<MedusaRequest, Buffer>()

/** The bytes `readRawBody` kept for this request; undefined where it kept none. */
export const rawBodyKept = (req: MedusaRequest): Buffer | undefined => rawBodies.get(req)

export const BODY_TIMEOUT_ENV = "AI_GATEWAY_BODY_TIMEOUT_MS"

/** The time a body may take: 30 s, or a test's own (`NODE_ENV=test` only). */
function bodyTimeoutMs(): number {
  const own = Number(process.env[BODY_TIMEOUT_ENV] ?? "")
  return process.env["NODE_ENV"] === "test" && Number.isSafeInteger(own) && own > 0
    ? own
    : AI_GATEWAY_BODY_TIMEOUT_MS
}

/**
 * Refused before (or while) the body is read: the rest is let through
 * unkept, so the shop reads its answer, and the connection closes after.
 */
function dropRest(req: MedusaRequest, res: MedusaResponse): void {
  res.setHeader("connection", "close")
  req.resume()
}

/** A body too slow: once answered, the connection goes, the unread rest with it. */
function closeAfter(req: MedusaRequest, res: MedusaResponse): void {
  res.setHeader("connection", "close")
  res.once("finish", () => {
    req.socket.destroy()
  })
}

/** The gateway's own refusal before the body is kept: its envelope, the rest let through unkept. */
function refuse(
  req: MedusaRequest,
  res: MedusaResponse,
  code: "body_too_large" | "unavailable"
): void {
  ensureRequestId(req, res)
  dropRest(req, res)
  res.setHeader(AI_CALL_RESPONSE_HEADERS.refusal, code)
  res.setHeader("cache-control", "no-store")
  // The gateway's envelope as its schema has it: the request id rides in its header
  res.status(AI_GATEWAY_REFUSALS[code]).json({ qt_ai_gateway: { code } })
}

/**
 * The process reads its limit of bodies (N2): answered 503 at once, the
 * body never kept; a sender still sending past the body's time loses its
 * connection.
 */
function tooBusy(req: MedusaRequest, res: MedusaResponse): void {
  refuse(req, res, "unavailable")
  const timer = setTimeout(() => {
    req.socket.destroy()
  }, bodyTimeoutMs())
  timer.unref()
  req.socket.once("close", () => {
    clearTimeout(timer)
  })
}

/** The signature guard's own words for what is refused before the body. */
const UNSIGNED: Readonly<Record<string, string>> = {
  "signature.missing_header": "signature.malformed",
  "signature.malformed": "signature.malformed",
  "signature.stale": "signature.stale",
}

export function readRawBody(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): void {
  const rule = matchTenantApi(req.method, routePath(req))
  if (rule?.rawBody !== true) {
    next()
    return
  }
  const unsigned = precheckSignedRequest(req.headers)
  if (unsigned !== null) {
    dropRest(req, res)
    const message = UNSIGNED[unsigned] ?? "signature.malformed"
    rejectRequest(req, res, 401, { type: "unauthorized", message }, unsigned)
    return
  }
  const max = rule.maxBodyBytes
  const declared = Number(req.headers["content-length"] ?? "")
  if (Number.isFinite(declared) && declared > max) {
    refuse(req, res, "body_too_large")
    return
  }
  // N2: whoever sends it, a body is kept only within the process's reads
  const release = holdBodyRead()
  if (release === null) {
    tooBusy(req, res)
    return
  }
  const chunks: Buffer[] = []
  let size = 0
  let done = false
  /** Every way out of the read: the slot back, the timer gone, no more bytes kept. */
  const stop = (): boolean => {
    if (done) {
      return false
    }
    done = true
    release()
    clearTimeout(timer)
    req.removeListener("data", onData)
    return true
  }
  const finish = (failed: "too_large" | "too_slow" | null) => {
    if (!stop()) {
      return
    }
    if (failed === "too_large") {
      chunks.length = 0
      refuse(req, res, "body_too_large")
      return
    }
    if (failed === "too_slow") {
      closeAfter(req, res)
      rejectRequest(
        req,
        res,
        408,
        { type: "timeout", message: "errors.request_timeout" },
        "body_too_slow"
      )
      return
    }
    rawBodies.set(req, Buffer.concat(chunks, size))
    next()
  }
  const timer = setTimeout(() => {
    finish("too_slow")
  }, bodyTimeoutMs())
  const onData = (chunk: Buffer) => {
    size += chunk.length
    if (size > max) {
      finish("too_large")
      return
    }
    chunks.push(chunk)
  }
  req.on("data", onData)
  req.once("end", () => {
    finish(null)
  })
  req.once("error", () => {
    if (stop()) {
      res.destroy()
    }
  })
  // The sender gone before its body ended: nothing to answer, the slot back
  req.once("close", () => {
    if (stop()) {
      chunks.length = 0
    }
  })
}
