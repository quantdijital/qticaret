import type { MedusaResponse } from "@medusajs/framework/http"

/**
 * The AI credits' conflicts a caller acts on (adr/0085 K11): a request
 * already pending, a request no longer pending, a grant reference used
 * for something else. Medusa's error handler words every 409 its own way
 * (an idempotency hint), so the routes say these keys themselves, as the
 * releases route says its own. Fixed words, never input.
 */
const AI_CONFLICT_KEYS: ReadonlySet<string> = new Set([
  "cp.ai_credit_order_pending",
  "cp.ai_credit_order_closed",
  "cp.ai_credit_grant_ref_conflict",
  // P3d: a capability routed to a service whose key the platform does not hold
  "cp.ai_route_no_key",
])

/**
 * `run`'s result; or, when it throws one of the AI conflicts, a 409
 * saying its key and `undefined` (the route has answered). Any other
 * error goes on to the error handler.
 */
export async function answeringAiConflicts<T>(
  res: MedusaResponse,
  run: () => Promise<T>
): Promise<T | undefined> {
  try {
    return await run()
  } catch (error) {
    const message = (error as { message?: unknown } | null)?.message
    if (typeof message === "string" && AI_CONFLICT_KEYS.has(message)) {
      res.status(409).json({ type: "conflict", message })
      return undefined
    }
    throw error
  }
}
