import { randomUUID } from "node:crypto"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { runWithRequestContext } from "../../lib/logging"

export const REQUEST_ID_HEADER = "X-Request-Id"

// UUIDs and the usual proxy and tracing formats. Medusa copies the incoming
// header unchecked; anything else is replaced so a caller cannot put
// arbitrary text into logs and responses.
const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/

export const isValidRequestId = (value: unknown): value is string =>
  typeof value === "string" && REQUEST_ID.test(value)

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
