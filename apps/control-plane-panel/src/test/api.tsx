import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import type { ReactElement } from "react"
import { vi } from "vitest"

/** One request the page made, as the control plane would read it. */
export interface Sent {
  method: string
  path: string
  headers: Record<string, string>
  body: unknown
}

export interface Answer {
  status: number
  body?: unknown
}

/**
 * The control plane, stood in for by `fetch`: each request is recorded and
 * answered by `answer` (by method and path). Returns the record.
 */
export function stubApi(answer: (call: Sent) => Answer): Sent[] {
  const sent: Sent[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init: RequestInit = {}) => {
      const call: Sent = {
        method: init.method ?? "GET",
        path: url,
        headers: (init.headers ?? {}) as Record<string, string>,
        body: typeof init.body === "string" ? (JSON.parse(init.body) as unknown) : undefined,
      }
      sent.push(call)
      const { status, body } = answer(call)
      return Promise.resolve(
        new Response(body === undefined ? null : JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        })
      )
    })
  )
  return sent
}

/** The control plane's refusal body: its stable key in `message`. */
export const refusal = (status: number, message: string, type = "not_allowed"): Answer => ({
  status,
  body: { type, message },
})

export function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) }
}
