import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { drainBody } from "../../lib/security/upload/drain"
import type { DrainLimits } from "../../lib/security/upload/drain"
import type { ErrorBody } from "./error-response"
import { rejectRequest } from "./reject"

/**
 * A refusal of an upload sent once its body has been drained (bounded;
 * `lib/security/upload/drain.ts`), or, past the bounds, with the connection
 * closed after it: the client reads the answer instead of a reset.
 */
export async function refuseAfterDrain(
  req: MedusaRequest,
  res: MedusaResponse,
  status: number,
  body: ErrorBody & Record<string, unknown>,
  reason: string,
  limits: DrainLimits = {}
): Promise<void> {
  if (!(await drainBody(req, limits))) {
    res.setHeader("Connection", "close")
  }
  if (!res.headersSent && !res.destroyed) {
    rejectRequest(req, res, status, body, reason)
  }
}
