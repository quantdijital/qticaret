import { getHttpResponseFromError } from "@medusajs/framework/http"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  DEFAULT_VALIDATION_MESSAGE,
  I18N_KEY,
  lockTimeoutError,
  toHttpError,
} from "../../lib/errors"
import { currentRequestId, logger } from "../../lib/logging"
import { forDashboard } from "./dashboard-messages"
import { INTERNAL_ERROR_BODY, sanitizeErrorResponse } from "./error-response"
import type { ErrorBody } from "./error-response"
import { logRejection } from "./reject"
import { ensureRequestId } from "./request-id"
import { loggedPath, requestPath } from "./request-path"
import { applySecurityHeaders } from "./security-headers"

/**
 * Replaces Medusa's error handler (`defineMiddlewares({ errorHandler })`):
 * - the platform's own errors map through `toHttpError` (lib/errors);
 * - body-parser's errors and stray ZodErrors get fixed bodies;
 * - everything else takes Medusa's status and body, then `sanitizeErrorResponse`;
 * - every body carries `request_id`, and the error is logged here, redacted,
 *   instead of Medusa logging the raw error and its `cause`.
 */

interface ResolvedError {
  status: number
  body: ErrorBody
  /** What the log line says instead of the response text, which may quote input. */
  reason: string
  retryAfterSeconds?: number
}

interface ClientHttpError {
  status: number
  type?: unknown
}

// http-errors' shape, as body-parser throws it. Its message can quote the
// raw body (V8's JSON errors do) and `body` holds all of it, so neither is
// sent or logged.
function clientHttpError(error: unknown): ClientHttpError | null {
  const fields = error as { status?: unknown; statusCode?: unknown; expose?: unknown } | null
  const status = fields?.status
  return typeof status === "number" &&
    status === fields?.statusCode &&
    typeof fields.expose === "boolean" &&
    status >= 400 &&
    status < 500
    ? (error as ClientHttpError)
    : null
}

const HTTP_ERROR_MESSAGES: Record<number, string> = {
  400: DEFAULT_VALIDATION_MESSAGE,
  413: "errors.request_too_large",
}

// A ZodError that reaches the handler was thrown by code, not by Medusa's
// request validators (they throw MedusaError); its paths may describe an
// internal or upstream schema, so only the fact is reported
const isZodError = (error: unknown): boolean => {
  const fields = error as { name?: unknown; issues?: unknown } | null
  return fields?.name === "ZodError" && Array.isArray(fields.issues) && fields.issues.length > 0
}

/**
 * Medusa's body validation wraps a rule's message: `Invalid request: <key>`.
 * One of our keys alone is given back as the key, so clients and the
 * panel read it like any other; anything longer is left as it is.
 */
function unwrapValidationKey(body: ErrorBody): ErrorBody {
  const key = /^Invalid request: (\S+)$/.exec(body.message)?.[1]
  return key && I18N_KEY.test(key) ? { ...body, message: key } : body
}

function resolveError(error: unknown, path: string): ResolvedError {
  const own = toHttpError(lockTimeoutError(error) ?? error)
  if (own) {
    return {
      status: own.status,
      body: own.body,
      reason: own.body.message,
      ...(own.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: own.retryAfterSeconds }),
    }
  }
  const httpError = clientHttpError(error)
  if (httpError) {
    const message = HTTP_ERROR_MESSAGES[httpError.status] ?? "errors.invalid_request"
    const kind = typeof httpError.type === "string" ? httpError.type : String(httpError.status)
    return {
      status: httpError.status,
      body: { type: "invalid_data", message },
      reason: `http_${kind}`,
    }
  }
  if (isZodError(error)) {
    const body = { type: "invalid_data", message: DEFAULT_VALIDATION_MESSAGE }
    return { status: 400, body, reason: "zod_error" }
  }
  const { statusCode, body } = getHttpResponseFromError(error)
  const sanitized = sanitizeErrorResponse(statusCode, body as ErrorBody, path)
  // A database message quotes row values; its kind is enough to debug
  const reason = sanitized.dbError === null ? sanitized.body.message : `db_${sanitized.dbError}`
  return { status: sanitized.status, body: unwrapValidationKey(sanitized.body), reason }
}

function logError(
  error: unknown,
  resolved: ResolvedError,
  req: MedusaRequest,
  requestId: string
): void {
  // A busy lock is an expected answer, not a failure: one line, no stack
  // and no lock key (it names a record)
  if (resolved.status < 500 || lockTimeoutError(error)) {
    logRejection(req, requestId, {
      status: resolved.status,
      type: resolved.body.type,
      reason: resolved.status < 500 ? resolved.reason : "lock_busy",
    })
    return
  }
  logger.error(
    {
      event: "http.request_failed",
      ...(currentRequestId() === undefined ? { request_id: requestId } : {}),
      method: req.method,
      path: loggedPath(requestPath(req)),
      status: resolved.status,
      type: resolved.body.type,
      err: error,
    },
    "request failed"
  )
}

function send(
  req: MedusaRequest,
  res: MedusaResponse,
  resolved: ResolvedError,
  requestId: string
): void {
  if (resolved.retryAfterSeconds !== undefined) {
    res.setHeader("Retry-After", String(resolved.retryAfterSeconds))
  }
  res.status(resolved.status).json({ ...forDashboard(req, resolved.body), request_id: requestId })
}

export function platformErrorHandler(
  error: unknown,
  req: MedusaRequest,
  res: MedusaResponse,
  // Express tells an error handler apart by its four parameters
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: MedusaNextFunction
): void {
  const requestId = ensureRequestId(req, res)
  // Errors raised before the header middleware ran (body parsing) get them here
  applySecurityHeaders(res)
  // Express's own fallback would print the raw stack to stderr; a response
  // that is already streaming can only be cut off
  if (res.headersSent) {
    logger.error(
      {
        event: "http.response_failed",
        request_id: requestId,
        path: loggedPath(requestPath(req)),
        err: error,
      },
      "response failed after headers were sent"
    )
    res.destroy()
    return
  }
  try {
    const resolved = resolveError(error, req.path)
    logError(error, resolved, req, requestId)
    send(req, res, resolved, requestId)
  } catch (handlerError) {
    // Mapping or logging failed (Medusa's formatter throws on malformed
    // database errors): answer with the generic 500 and record both
    logger.error(
      {
        event: "http.error_handler_failed",
        request_id: requestId,
        err: handlerError,
        original: error,
      },
      "error handler failed"
    )
    res.status(500).json({ ...INTERNAL_ERROR_BODY, request_id: requestId })
  }
}
