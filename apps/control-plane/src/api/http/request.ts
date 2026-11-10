import { randomUUID } from "node:crypto"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { Logger } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  HSTS_HEADER,
  REQUEST_ID_HEADER,
  SECURITY_HEADERS,
  isLocalEnv,
  isValidRequestId,
  routePathOf,
  targetPath,
} from "@qticaret/server-kit"

/**
 * The request's target as written. Medusa mounts a middleware without
 * `methods` with `app.use`, which strips the mount path from `req.path`;
 * `originalUrl` keeps it.
 */
export function requestTarget(req: MedusaRequest): string {
  const fields = req as { originalUrl?: string; url?: string; path?: string }
  return fields.originalUrl ?? fields.url ?? fields.path ?? "/"
}

/** The path as Express routes it (lower-cased, no trailing slash), for deciding which rule applies. */
export const routePath = (req: MedusaRequest): string => routePathOf(requestTarget(req))

export function loggerOf(req: MedusaRequest): Logger | undefined {
  try {
    return req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
  } catch {
    return undefined
  }
}

/**
 * `req.requestId` (Medusa copies `x-request-id` unchecked) when it is one,
 * else a new UUID; echoed in the response. Idempotent.
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

/** The shared security headers (docs/04); HSTS outside local development. */
export function applySecurityHeaders(res: MedusaResponse): void {
  if (res.headersSent) {
    return
  }
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(name, value)
  }
  if (!isLocalEnv({ NODE_ENV: process.env["NODE_ENV"] })) {
    res.setHeader("Strict-Transport-Security", HSTS_HEADER)
  }
  res.removeHeader("X-Powered-By")
}

/**
 * Answers a request a middleware refuses: security headers, a JSON body
 * with the request ID, one log line naming the reason (never the body, the
 * query or a header).
 */
export function rejectRequest(
  req: MedusaRequest,
  res: MedusaResponse,
  status: number,
  body: { type: string; message: string },
  reason: string
): void {
  const requestId = ensureRequestId(req, res)
  applySecurityHeaders(res)
  loggerOf(req)?.info(
    `http.request_rejected ${JSON.stringify({
      request_id: requestId,
      method: req.method,
      path: targetPath(requestTarget(req)).slice(0, 200),
      status,
      reason,
    })}`
  )
  res.status(status).json({ ...body, request_id: requestId })
}
