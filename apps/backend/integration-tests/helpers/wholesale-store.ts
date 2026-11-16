import type { HttpResponse } from "./http"
import { settle } from "./http"

/** An answer as an assertion sees it: never axios' own objects (they hold each other). */
export interface Plain<T> {
  status: number
  data: T
  cacheControl: string | null
}

/**
 * Settles a call to a plain answer. axios' response holds its request,
 * which holds the response back: such an object reaching a failed
 * assertion, or thrown, breaks Jest's worker ("child process exceptions").
 */
export async function plain<T>(request: Promise<HttpResponse<T>>): Promise<Plain<T>> {
  try {
    const { status, data, headers } = await settle(request)
    const cacheControl = headers["cache-control"]
    return { status, data, cacheControl: typeof cacheControl === "string" ? cacheControl : null }
  } catch (error) {
    const { message, code } = error as { message?: unknown; code?: unknown }
    // The cause would carry axios' circular objects to Jest's worker: its text is enough
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`request failed without an answer: ${String(code)} ${String(message)}`)
  }
}

/** Status and, only when it is not the one expected, the body: what a failure needs to say. */
export const outcome = (answer: { status: number; data: unknown }, expected: number) => ({
  status: answer.status,
  data: answer.status === expected ? null : answer.data,
})
