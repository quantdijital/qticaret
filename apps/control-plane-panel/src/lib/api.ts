/**
 * The panel's client for the control plane (adr/0061 §1.3): same origin,
 * the session cookie as the credential, JSON both ways. No token is kept
 * in the browser: a sign-in's bearer token is used once, to open the
 * session (`POST /auth/session`), and dropped. The control plane answers a
 * refusal with a stable key in `message` (`cp.mfa_required`), which the
 * panel turns into words (lib/errors.ts); Medusa's own refusals carry an
 * English sentence there instead.
 */

export class ApiError extends Error {
  readonly status: number
  /** The control plane's key (`cp.*`, `errors.*`), or Medusa's sentence. */
  readonly code: string
  readonly type: string | null

  constructor(status: number, code: string, type: string | null) {
    super(code || `http_${String(status)}`)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.type = type
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError

export const statusOf = (error: unknown): number | null => (isApiError(error) ? error.status : null)

export const codeOf = (error: unknown): string | null => (isApiError(error) ? error.code : null)

export interface RequestOptions {
  method?: "GET" | "POST" | "DELETE"
  body?: unknown
  /** Query string values; empty ones are left out. */
  query?: Record<string, string | number | undefined>
  headers?: Record<string, string>
  /** A sign-in's own token, for the routes that take one (opening the session, an invitation). */
  bearer?: string
}

function urlOf(path: string, query: RequestOptions["query"]): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value))
    }
  }
  const search = params.toString()
  return search ? `${path}?${search}` : path
}

async function failureOf(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null
  const message = typeof body?.["message"] === "string" ? body["message"] : ""
  const type = typeof body?.["type"] === "string" ? body["type"] : null
  return new ApiError(response.status, message, type)
}

/** One call; a refusal throws an `ApiError`, anything unreachable the browser's own error. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, headers = {}, bearer } = options
  const response = await fetch(urlOf(path, query), {
    method,
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  if (!response.ok) {
    throw await failureOf(response)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json().catch(() => undefined)) as T
}
