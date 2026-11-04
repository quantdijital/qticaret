import type { z } from "@medusajs/framework/zod"
import type { StructuredLogger } from "../logging"
import type { CircuitBreakerOptions } from "./circuit-breaker"
import type { FailureLog } from "./failure-log"
import type { FormValues, QueryValues, RequestPath } from "./request"
import type { RetryPolicy } from "./retry"
import type { Transport } from "./transport"

/** What a provider's client is made with, and what one call asks (http-client.ts). */

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
  /**
   * The account's values the provider may quote back in its refusal (a
   * user name, a password, a customer code): masked in the text a failure
   * keeps for staff (`providerText`), never stored.
   */
  secrets?: readonly (string | null | undefined)[]
  signal?: AbortSignal
  schema: z.ZodType<T>
}

export interface HttpClient {
  readonly provider: string
  request<T>(request: HttpRequest<T>): Promise<T>
}
