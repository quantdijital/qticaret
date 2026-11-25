import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AI_CALL_RESPONSE_HEADERS, AI_GATEWAY_REFUSALS } from "@qticaret/types/control-plane"
import { matchTenantApi } from "../../lib/fleet/tenant-api-routes"
import { ensureRequestId, routePath } from "./request"

/**
 * A raw body route's bytes (`rawBody` in the tenant API table: the AI
 * gateway's call), read before the signature guard: the body parsers are
 * off for it (`bodyParser: false`), so a JSON body and a form alike are
 * kept exactly as sent and parsed by nothing before the signature over
 * them is checked. Held to the route's size: a declared length past it is
 * refused unread, a stream past it is cut and refused (413, the gateway's
 * own refusal). Any other request passes untouched.
 */

const rawBodies = new WeakMap<MedusaRequest, Buffer>()

/** The bytes `readRawBody` kept for this request; undefined where it kept none. */
export const rawBodyKept = (req: MedusaRequest): Buffer | undefined => rawBodies.get(req)

function tooLarge(req: MedusaRequest, res: MedusaResponse): void {
  const requestId = ensureRequestId(req, res)
  res.setHeader("connection", "close")
  res.setHeader(AI_CALL_RESPONSE_HEADERS.refusal, "body_too_large")
  res.setHeader("cache-control", "no-store")
  res
    .status(AI_GATEWAY_REFUSALS.body_too_large)
    .json({ qt_ai_gateway: { code: "body_too_large" }, request_id: requestId })
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
  const max = rule.maxBodyBytes
  const declared = Number(req.headers["content-length"] ?? "")
  if (Number.isFinite(declared) && declared > max) {
    req.resume()
    tooLarge(req, res)
    return
  }
  const chunks: Buffer[] = []
  let size = 0
  let done = false
  const finish = (failed: boolean) => {
    if (done) {
      return
    }
    done = true
    req.removeListener("data", onData)
    if (failed) {
      tooLarge(req, res)
      req.resume()
      return
    }
    rawBodies.set(req, Buffer.concat(chunks, size))
    next()
  }
  const onData = (chunk: Buffer) => {
    size += chunk.length
    if (size > max) {
      finish(true)
      return
    }
    chunks.push(chunk)
  }
  req.on("data", onData)
  req.once("end", () => {
    finish(false)
  })
  req.once("error", () => {
    if (!done) {
      done = true
      res.destroy()
    }
  })
}
