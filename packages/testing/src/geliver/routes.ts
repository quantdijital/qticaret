/** One request as a fake Geliver handler reads it. */
export interface FakeRequest {
  body: Record<string, unknown>
  query: URLSearchParams
  /** The path's `:id` parts, in order. */
  params: string[]
}

export interface Reply {
  status?: number
  body: unknown
  /** Bytes instead of JSON (a label). */
  bytes?: { type: string; data: Buffer }
}

export type Handler = (request: FakeRequest) => Reply

/** Geliver's envelope around a result; a list's page fields sit beside `data`. */
export const ok = (data: unknown, extra: Record<string, unknown> = {}): Reply => ({
  body: { result: true, data, ...extra },
})

export const failed = (status: number, code: string, message: string): Reply => ({
  status,
  body: { result: false, code, message },
})

/** `GET /shipments/:id` → a pattern matching `GET /shipments/abc`, its parts captured. */
export function matchRoute(
  routes: Readonly<Record<string, Handler>>,
  method: string,
  path: string
): { handler: Handler; params: string[] } | null {
  for (const [route, handler] of Object.entries(routes)) {
    const [routeMethod, routePath = ""] = route.split(" ")
    if (routeMethod !== method) {
      continue
    }
    const pattern = new RegExp(`^${routePath.replace(/:[a-z]+/gi, "([^/]+)")}$`)
    const found = pattern.exec(path)
    if (found) {
      return { handler, params: found.slice(1).map(decodeURIComponent) }
    }
  }
  return null
}
