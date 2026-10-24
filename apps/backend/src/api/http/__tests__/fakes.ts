import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export interface FakeResponse {
  res: MedusaResponse
  headers: Record<string, string>
  status: () => number
  body: () => unknown
  destroyed: () => boolean
}

export function fakeRequest(fields: { path?: string; method?: string; requestId?: unknown } = {}) {
  return {
    path: fields.path ?? "/store/customers",
    originalUrl: fields.path ?? "/store/customers",
    method: fields.method ?? "POST",
    requestId: fields.requestId,
  } as unknown as MedusaRequest
}

export function fakeResponse(headersSent = false): FakeResponse {
  const headers: Record<string, string> = {}
  let statusCode = 200
  let sent: unknown
  let destroyed = false
  const res = {
    headersSent,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value
      return res
    },
    removeHeader(name: string) {
      // Recorded as removed, so tests can tell it from "never set"
      headers[name.toLowerCase()] = "<removed>"
    },
    status(code: number) {
      statusCode = code
      return res
    },
    json(body: unknown) {
      sent = body
      return res
    },
    destroy() {
      destroyed = true
      return res
    },
  }
  return {
    res: res as unknown as MedusaResponse,
    headers,
    status: () => statusCode,
    body: () => sent,
    destroyed: () => destroyed,
  }
}
