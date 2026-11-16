import type {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { errorSummary, logger } from "../../lib/logging"
import { drainBody } from "../../lib/security/upload/drain"
import type { DrainLimits } from "../../lib/security/upload/drain"
import type { ErrorBody } from "./error-response"
import { rejectRequest } from "./reject"

/** Room above a route's own limit within which a refused body is still drained. */
const DRAIN_MARGIN = 1.25

/** How far a refused body of a route limited to `routeLimit` bytes is drained. */
export const drainLimitFor = (routeLimit: number): DrainLimits => ({
  maxBytes: Math.ceil(routeLimit * DRAIN_MARGIN),
})

/**
 * Whether Medusa's authentication found a person or a key on the request.
 * It runs before every middleware of ours (`@medusajs/framework/http`
 * router: body parser, CORS and auth, then the middlewares), so a request
 * without one here is a stranger's: its body is never drained for it
 * (security review B1).
 */
const signedIn = (req: MedusaRequest): boolean =>
  Boolean((req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id)

/**
 * A refusal of an upload sent once its body has been drained (bounded;
 * `lib/security/upload/drain.ts`), so the client reads the answer instead
 * of a reset; a stranger's, or one past the bounds, at once with the
 * connection closed after it. Never throws.
 */
export async function refuseAfterDrain(
  req: MedusaRequest,
  res: MedusaResponse,
  status: number,
  body: ErrorBody & Record<string, unknown>,
  reason: string,
  limits: DrainLimits
): Promise<void> {
  try {
    const drained = signedIn(req) && (await drainBody(req, limits))
    if (res.headersSent || res.destroyed) {
      return
    }
    if (!drained) {
      res.setHeader("Connection", "close")
    }
    rejectRequest(req, res, status, body, reason)
  } catch (error) {
    logger.error({ event: "http.refusal_failed", reason, err: errorSummary(error) })
  }
}

/** `refuseAfterDrain` from a synchronous middleware: started, and any failure logged. */
export function refuse(
  req: MedusaRequest,
  res: MedusaResponse,
  status: number,
  body: ErrorBody & Record<string, unknown>,
  reason: string,
  limits: DrainLimits
): void {
  refuseAfterDrain(req, res, status, body, reason, limits).catch((error: unknown) => {
    logger.error({ event: "http.refusal_failed", reason, err: errorSummary(error) })
  })
}
