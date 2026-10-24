import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { currentRequestId, logger } from "../../lib/logging"
import type { ErrorBody } from "./error-response"
import { ensureRequestId } from "./request-id"
import { requestPath } from "./request-path"
import { applySecurityHeaders } from "./security-headers"

export interface Rejection {
  status: number
  type: string | undefined
  /** What the log says instead of the response text, which may quote input. */
  reason: string
}

/** The log line for a 4xx answer, shared by the error handler and direct rejections. */
export function logRejection(req: MedusaRequest, requestId: string, rejection: Rejection): void {
  logger.info(
    {
      event: "http.request_rejected",
      // Inside the request's log context the logger adds it; rejections
      // before `requestContext` ran (body parsing, auth) need it here
      ...(currentRequestId() === undefined ? { request_id: requestId } : {}),
      method: req.method,
      path: requestPath(req),
      ...rejection,
    },
    "request rejected"
  )
}

/**
 * Answers a request a middleware refuses itself, in the error handler's
 * shape: logged, with `request_id` in the body. For bodies that carry more
 * than a message (field issues), which a thrown error cannot.
 */
export function rejectRequest(
  req: MedusaRequest,
  res: MedusaResponse,
  status: number,
  body: ErrorBody & Record<string, unknown>,
  reason: string
): void {
  const requestId = ensureRequestId(req, res)
  applySecurityHeaders(res)
  logRejection(req, requestId, { status, type: body.type, reason })
  res.status(status).json({ ...body, request_id: requestId })
}
