import { getHttpResponseFromError } from "@medusajs/framework/http"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  INTERNAL_ERROR_BODY,
  classifyDbMessage,
  failureCode,
  keyMessage,
  targetPath,
} from "@qticaret/server-kit"
import { applySecurityHeaders, ensureRequestId, loggerOf, requestTarget } from "./request"

/**
 * Replaces Medusa's error handler (`defineMiddlewares({ errorHandler })`,
 * adr/0061 Ek C19 M1). Medusa's own logs the raw error: a MikroORM driver
 * error carries its SQL with the bound values (a contact's e-mail and
 * phone, a company's address and VKN, a sealed TCKN, a payment reference).
 * Here:
 * - the status and body are Medusa's (`getHttpResponseFromError`), so the
 *   `cp.*` keys the panel reads stay as they are;
 * - every 5xx answers with the fixed body, except a stable `cp.*` /
 *   `provisioning.*` key the route threw as its own message
 *   (`UNEXPECTED_STATE`: `cp.tckn_unreadable`, `cp.mfa_start_failed`,
 *   `cp.invite_failed`), which the panel maps; a 4xx whose text Medusa built
 *   from a database error (a duplicate quotes the row) becomes the generic
 *   `errors.invalid_request`; body-parser's errors (V8's text can quote the
 *   raw body) too;
 * - the log line carries `{ request_id, method, path, status, code }` only,
 *   `code` being a stable key, a SQLSTATE or the error's type: never the
 *   message, the stack or the cause.
 */

interface Resolved {
  status: number
  body: { type?: string; message: string; code?: string }
  code: string
}

const GENERIC_MESSAGE = "errors.invalid_request"
const TYPE = /^[a-z_]{1,40}$/
// The 5xx keys the panel reads (adr/0061 Ek C19 takip LOW-1): fixed words a
// route throws, never input
const PANEL_KEY = /^(cp|provisioning)\.[a-z0-9_.]+$/

function panelKey(error: unknown): string | null {
  const key = keyMessage(error)
  return key !== null && PANEL_KEY.test(key) ? key : null
}

// http-errors' shape, as body-parser throws it
function clientHttpError(error: unknown): number | null {
  const fields = error as { status?: unknown; statusCode?: unknown; expose?: unknown } | null
  const status = fields?.status
  return typeof status === "number" &&
    status === fields?.statusCode &&
    typeof fields.expose === "boolean" &&
    status >= 400 &&
    status < 500
    ? status
    : null
}

function codeOf(error: unknown, type: string | undefined): string {
  const own = keyMessage(error) ?? failureCode(error)
  if (own !== "unknown") {
    return own
  }
  return type !== undefined && TYPE.test(type) ? type : "unknown"
}

export function resolveCpError(error: unknown): Resolved {
  const httpStatus = clientHttpError(error)
  if (httpStatus !== null) {
    return {
      status: httpStatus,
      body: { type: "invalid_data", message: GENERIC_MESSAGE },
      code: `http_${String(httpStatus)}`,
    }
  }
  const { statusCode, body } = getHttpResponseFromError(error) as {
    statusCode: number
    body: { type?: string; message: string; code?: string }
  }
  const message = typeof body.message === "string" ? body.message : ""
  const dbError = classifyDbMessage(message)
  if (statusCode >= 500) {
    const key = panelKey(error)
    if (key !== null) {
      return { status: statusCode, body: { type: "unexpected_state", message: key }, code: key }
    }
    return { status: statusCode, body: { ...INTERNAL_ERROR_BODY }, code: codeOf(error, body.type) }
  }
  if (dbError !== null) {
    return {
      status: statusCode,
      body: { type: body.type ?? "invalid_data", message: GENERIC_MESSAGE },
      code: `db_${dbError}`,
    }
  }
  return { status: statusCode, body, code: keyMessage({ message }) ?? codeOf(error, body.type) }
}

function logLine(req: MedusaRequest, requestId: string, resolved: Resolved): void {
  const fields = {
    request_id: requestId,
    method: req.method,
    path: targetPath(requestTarget(req)).slice(0, 200),
    status: resolved.status,
    code: resolved.code,
  }
  const logger = loggerOf(req)
  if (resolved.status >= 500) {
    logger?.error(`http.request_failed ${JSON.stringify(fields)}`)
  } else {
    logger?.info(`http.request_rejected ${JSON.stringify(fields)}`)
  }
}

export function cpErrorHandler(
  error: unknown,
  req: MedusaRequest,
  res: MedusaResponse,
  // Express tells an error handler apart by its four parameters
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: MedusaNextFunction
): void {
  const requestId = ensureRequestId(req, res)
  applySecurityHeaders(res)
  if (res.headersSent) {
    loggerOf(req)?.error(
      `http.response_failed ${JSON.stringify({ request_id: requestId, code: failureCode(error) })}`
    )
    res.destroy()
    return
  }
  let resolved: Resolved
  try {
    resolved = resolveCpError(error)
  } catch {
    // Medusa's formatter throws on a malformed database error
    resolved = { status: 500, body: { ...INTERNAL_ERROR_BODY }, code: failureCode(error) }
  }
  logLine(req, requestId, resolved)
  res.status(resolved.status).json({ ...resolved.body, request_id: requestId })
}
