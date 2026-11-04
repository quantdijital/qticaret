import { vi } from "vitest"
import type { Mock } from "vitest"

/**
 * The synonym writes go by `fetch` (their refusal's key kept): answered by
 * the same mock as the SDK's reads, called as the SDK would be (`{ method,
 * body }`). A rejection `{ status, ...body }` becomes the server's answer.
 */
export function answerWritesWith(mock: Mock) {
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const body = typeof init.body === "string" ? { body: JSON.parse(init.body) as unknown } : {}
    try {
      const answer: unknown = await mock(url, { method: init.method, ...body })
      return new Response(JSON.stringify(answer), { status: 200 })
    } catch (failure) {
      const { status = 500, ...sent } = failure as { status?: number }
      return new Response(JSON.stringify(sent), { status })
    }
  })
}
