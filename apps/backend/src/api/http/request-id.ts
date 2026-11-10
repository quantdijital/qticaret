import { randomUUID } from "node:crypto"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { REQUEST_ID_HEADER, isValidRequestId } from "@qticaret/server-kit"
import { runWithRequestContext } from "../../lib/logging"

// Shared with the control plane (adr/0061, C3)
export { REQUEST_ID_HEADER, isValidRequestId } from "@qticaret/server-kit"

/**
 * Validates `req.requestId` (set by Medusa from `x-request-id`), replaces it
 * with a UUID when needed and echoes it in the response. Idempotent: the
 * error handler calls it again for errors raised before `requestContext` ran.
 */
export function ensureRequestId(req: MedusaRequest, res: MedusaResponse): string {
  const current: unknown = req.requestId
  const requestId = isValidRequestId(current) ? current : randomUUID()
  req.requestId = requestId
  if (!res.headersSent) {
    res.setHeader(REQUEST_ID_HEADER, requestId)
  }
  return requestId
}

/** Global middleware: every log line written while the request runs carries its ID. */
export function requestContext(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): void {
  const requestId = ensureRequestId(req, res)
  runWithRequestContext({ requestId }, next)
}
