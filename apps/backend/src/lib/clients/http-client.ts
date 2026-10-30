import type { z } from "@medusajs/framework/zod"
import { ProviderError } from "../errors"
import { currentRequestId, logger as platformLogger } from "../logging"
import type { LogFields, StructuredLogger } from "../logging"
import { CircuitBreaker, DEFAULT_CIRCUIT_BREAKER } from "./circuit-breaker"
import { noteGivenUp } from "./failure-log"
import type { FailureLog } from "./failure-log"
import type { CircuitBreakerOptions } from "./circuit-breaker"
import {
  HttpClientMisuse,
  buildUrl,
  contentTypeHeader,
  describeNetworkError,
  integerOption,
  mergeHeaders,
  parseJsonBody,
  serializeBody,
  wasNotSent,
} from "./request"
import type { FormValues, QueryValues, RequestPath } from "./request"
import { IDEMPOTENT_METHODS, backoffDelay, parseRetryAfter, resolveRetryPolicy } from "./retry"
import type { RetryPolicy } from "./retry"
import { ResponseTooLarge, TransportRefusal, callTransport, fetchTransport } from "./transport"
import type { Transport, TransportResponse } from "./transport"

/**
 * The HTTP client every provider integration uses (docs/03 F2.1): timeout,
 * retries with backoff, a circuit breaker per provider, request ID
 * correlation, Zod-checked responses, and one log line per attempt with
 * fixed fields only (no headers, query, body or error text).
 *
 * Retries never risk doing something twice: a request that is not
 * idempotent is repeated only when it certainly did not reach the provider,
 * and a failure whose outcome is unknown (a timeout after sending, a gateway
 * error) is `outcome_unknown`, not retryable. Payment integrations check
 * the provider's status for it before trying again.
 */

// What a provider's error code may be: a short token such as `PERMISSION_DENIED` or `10051`
const PROVIDER_CODE = /^[A-Za-z0-9_.-]{1,60}$/
export interface HttpClientOptions {
  provider: string
  baseUrl: string
  defaultHeaders?: Readonly<Record<string, string>>
  timeoutMs?: number
  maxResponseBytes?: number
  retry?: Partial<RetryPolicy>
  circuitBreaker?: Partial<CircuitBreakerOptions>
  /** `safeTransport` for URLs a user or tenant supplies. */
  transport?: Transport
  /** Webhook URLs keep their secret in the path: log no path at all. */
  hidePaths?: boolean
  /** Reads the provider's own code (`card_declined`) from an error body. */
  errorCode?: (body: unknown, status: number) => string | undefined
  /** Where a failed call is noted for the Integrations page; the tenant's shared log by default. */
  failureLog?: () => FailureLog
  logger?: StructuredLogger
  sleep?: (ms: number) => Promise<void>
  random?: () => number
  now?: () => number
}

export interface HttpRequest<T> {
  method?: string
  /** A raw path, or segments that are encoded one by one (input such as an ID). */
  path: RequestPath
  query?: QueryValues
  headers?: Readonly<Record<string, string>>
  json?: unknown
  /** Form fields, sent URL-encoded; instead of `json`. */
  form?: FormValues
  /**
   * An XML document (a SOAP envelope), instead of `json`: its answer is
   * handed to `schema` as text, for the caller to read (adr/0035).
   */
  xml?: string
  /** The answer is handed to `schema` as text whatever was sent (a provider answering plain lines). */
  textAnswer?: boolean
  /** Marks a POST or PATCH as safe to repeat (it carries an idempotency key). */
  idempotent?: boolean
  /** Logged instead of the path when it holds secrets or identifiers (`/services/:token`). */
  logPath?: string
  signal?: AbortSignal
  schema: z.ZodType<T>
}

export interface HttpClient {
  readonly provider: string
  request<T>(request: HttpRequest<T>): Promise<T>
}

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024
// The transport owns the timeout; this backstop covers one that ignores it
const CLIENT_TIMEOUT_GRACE_MS = 1_000
// Turned away before any work: safe to send again
const REJECTED_STATUSES = new Set([429, 503])
// A gateway lost the answer: the provider may have done the work
const GATEWAY_STATUSES = new Set([502, 504])

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

interface Prepared {
  url: URL
  method: string
  headers: Record<string, string>
  body: string | undefined
  /** The answer is text for the caller to read (XML), not JSON. */
  text: boolean
  repeatable: boolean
  fields: LogFields
}

// What to do after one try: return a value, wait and try again, or throw (with
// the status the provider answered; `quiet` when the call never got to it)
type Next<T> = { value: T } | { delay: number } | { error: Error; status?: number; quiet?: true }

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const baseUrl = new URL(options.baseUrl)
  if (baseUrl.username !== "" || baseUrl.password !== "") {
    throw new HttpClientMisuse("http client: the base URL must not carry credentials")
  }
  const policy = resolveRetryPolicy(options.retry)
  const timeoutMs = integerOption("timeoutMs", options.timeoutMs, DEFAULT_TIMEOUT_MS, 1)
  const maxResponseBytes = integerOption(
    "maxResponseBytes",
    options.maxResponseBytes,
    DEFAULT_MAX_RESPONSE_BYTES,
    1
  )
  const breaker = new CircuitBreaker(
    { ...DEFAULT_CIRCUIT_BREAKER, ...options.circuitBreaker },
    options.now
  )
  const transport = options.transport ?? fetchTransport
  const log = options.logger ?? platformLogger
  const sleep = options.sleep ?? wait
  const random = options.random ?? Math.random
  const clock = options.now ?? Date.now
  const { provider } = options

  const failure = (
    providerCode: string,
    retryable: boolean,
    extra: { cause?: unknown; retryAfterMs?: number } = {}
  ) => new ProviderError({ provider, providerCode, retryable, ...extra })

  function prepare(request: HttpRequest<unknown>): Prepared {
    const method = (request.method ?? "GET").toUpperCase()
    const url = buildUrl(baseUrl, request.path, request.query)
    const requestId = currentRequestId()
    const headers = mergeHeaders(
      { accept: request.xml === undefined ? "application/json" : "text/xml" },
      options.defaultHeaders,
      request.headers,
      contentTypeHeader(request.json, request.form, request.xml),
      requestId === undefined ? undefined : { "x-request-id": requestId }
    )
    const path = options.hidePaths ? "[hidden]" : (request.logPath ?? url.pathname)
    return {
      url,
      method,
      headers,
      body: serializeBody(method, request.json, request.form, request.xml),
      text: request.xml !== undefined || request.textAnswer === true,
      repeatable: request.idempotent ?? IDEMPOTENT_METHODS.has(method),
      fields: { event: "http_client.request", provider, method, path },
    }
  }

  function afterNetworkError<T>(error: unknown, prepared: Prepared, attempt: number): Next<T> {
    if (error instanceof ResponseTooLarge) {
      breaker.recordSuccess()
      return { error: failure("response_too_large", false) }
    }
    breaker.recordFailure()
    const cause = describeNetworkError(error)
    const safeToRepeat = prepared.repeatable || wasNotSent(error)
    if (!safeToRepeat) {
      return { error: failure("outcome_unknown", false, { cause }) }
    }
    if (attempt >= policy.attempts) {
      return { error: failure("network_error", true, { cause }) }
    }
    return { delay: backoffDelay(attempt - 1, policy, random) }
  }

  function errorFrom(response: TransportResponse, prepared: Prepared): Error {
    const { status } = response
    if (status >= 500 && status !== 503 && !prepared.repeatable) {
      return failure("outcome_unknown", false)
    }
    if (REJECTED_STATUSES.has(status) || GATEWAY_STATUSES.has(status)) {
      const retryAfterMs = parseRetryAfter(response.header("retry-after"), options.now?.())
      return failure(
        `http_${String(status)}`,
        true,
        retryAfterMs === undefined ? {} : { retryAfterMs }
      )
    }
    const body = parseJsonBody(response.text)
    const said = body === "invalid" ? undefined : options.errorCode?.(body.value, status)
    // A provider's word, never its sentence: it reaches logs, the failure log and the panel
    const code = said !== undefined && PROVIDER_CODE.test(said) ? said : undefined
    return failure(code ?? `http_${String(status)}`, false)
  }

  function afterResponse<T>(
    response: TransportResponse,
    prepared: Prepared,
    schema: z.ZodType<T>,
    attempt: number
  ): Next<T> {
    const { status } = response
    if (status >= 500) {
      breaker.recordFailure()
    } else {
      breaker.recordSuccess()
    }
    if (status >= 200 && status < 300) {
      return { value: parse(response, schema, prepared.text) }
    }
    const retryable =
      status === 429 || (prepared.repeatable && (status === 503 || GATEWAY_STATUSES.has(status)))
    const retryAfter = parseRetryAfter(response.header("retry-after"), options.now?.())
    if (!retryable || attempt >= policy.attempts || (retryAfter ?? 0) > policy.maxRetryAfterMs) {
      return { error: errorFrom(response, prepared), status }
    }
    const backoff = backoffDelay(attempt - 1, policy, random)
    // Retry-After plus a little jitter, so callers told the same time do not return together
    return {
      delay:
        retryAfter === undefined ? backoff : retryAfter + Math.floor(random() * policy.baseDelayMs),
    }
  }

  function parse<T>(response: TransportResponse, schema: z.ZodType<T>, text: boolean): T {
    const body = text ? { value: response.text } : parseJsonBody(response.text)
    // No cause for invalid JSON: V8's SyntaxError quotes the body
    if (body === "invalid") {
      throw failure("invalid_response", false)
    }
    const parsed = schema.safeParse(body.value)
    if (!parsed.success) {
      throw failure("invalid_response", false, { cause: parsed.error })
    }
    return parsed.data
  }

  async function attemptOnce<T>(
    prepared: Prepared,
    request: HttpRequest<T>,
    attempt: number
  ): Promise<Next<T>> {
    const permit = breaker.acquire()
    if (!permit) {
      return { error: failure("circuit_open", true) }
    }
    let recorded = false
    try {
      const started = clock()
      const outcome = await callTransport(
        transport,
        {
          url: prepared.url.href,
          method: prepared.method,
          headers: prepared.headers,
          ...(prepared.body === undefined ? {} : { body: prepared.body }),
          timeoutMs,
          maxResponseBytes,
        },
        timeoutMs + CLIENT_TIMEOUT_GRACE_MS,
        request.signal
      )
      const fields = { ...prepared.fields, attempt, duration_ms: clock() - started }
      // Neither says anything about the provider: the permit goes back unrecorded
      if ("error" in outcome && outcome.error instanceof TransportRefusal) {
        log.warn({ ...fields, outcome: "refused" })
        return { error: failure("url_not_allowed", false), quiet: true }
      }
      if ("error" in outcome && request.signal?.aborted) {
        log.info({ ...fields, outcome: "aborted" })
        return { error: failure("aborted", false), quiet: true }
      }
      recorded = true
      if ("error" in outcome) {
        log.warn({
          ...fields,
          outcome: "network_error",
          error: describeNetworkError(outcome.error),
        })
        return afterNetworkError(outcome.error, prepared, attempt)
      }
      log.info({ ...fields, status: outcome.response.status })
      return afterResponse(outcome.response, prepared, request.schema, attempt)
    } finally {
      if (!recorded) {
        breaker.release(permit)
      }
    }
  }

  // The call given up on, for the Integrations page: what the log line says, no more
  const noteFailure = (prepared: Prepared, error: unknown, status: number | null) => {
    noteGivenUp(provider, { ...prepared, error, status, at: clock() }, options.failureLog)
  }

  async function request<T>(request: HttpRequest<T>): Promise<T> {
    // Misuse is refused here, before the breaker or a retry sees it
    const prepared = prepare(request)
    for (let attempt = 1; ; attempt++) {
      let next: Next<T>
      try {
        next = await attemptOnce(prepared, request, attempt)
      } catch (error) {
        // An answer that is not what the provider documents
        noteFailure(prepared, error, null)
        throw error
      }
      if ("value" in next) {
        return next.value
      }
      if ("error" in next) {
        if (next.quiet !== true) {
          noteFailure(prepared, next.error, next.status ?? null)
        }
        throw next.error
      }
      await sleep(next.delay)
    }
  }

  return { provider, request }
}
