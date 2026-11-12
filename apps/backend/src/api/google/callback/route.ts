import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { errorSummary, logger } from "../../../lib/logging"
import { isValidationError } from "../../../lib/errors"
import { REVIEWS_STATE_PREFIX, panelPathOfState } from "../../../lib/google/oauth"
import { planModeFor } from "../../../lib/plan-guard"
import {
  dropGoogleStateWorkflow,
  finishGoogleConnectWorkflow,
} from "../../../workflows/google/connect"
import { adoptOnlyGoogleLocation } from "../../../workflows/google/reviews-sync"
import type { GoogleCallbackQueryType } from "../../admin/google/validators"

/**
 * GET /google/callback (F10 M13): where Google sends the staff member back
 * from its consent screen. The `state` names the connection under way
 * (used once, by the staff member signed in who started it); the code
 * becomes the shop's refresh token. Whatever happens, the browser goes
 * back to the panel page the connection started from (the state's prefix:
 * Google reviews, adr/0058; else Settings > Marketing) with one word of
 * outcome. Connected for its reviews, a shop with one location has it
 * picked and read at once.
 *
 * A GET outside `/admin`, so the panel's plan guard never sees it (adr/0061
 * Ek C19 L2): a restricted or suspended shop connects nothing (the start,
 * `POST /admin/google/connect`, is closed to it too); the state is dropped
 * and the panel hears `google=restricted`.
 */
export async function GET(
  req: MedusaRequest<unknown, GoogleCallbackQueryType>,
  res: MedusaResponse
): Promise<void> {
  const { state, code, error } = req.validatedQuery as GoogleCallbackQueryType
  const back = (outcome: string) => {
    const page = panelPathOfState(state)
    res.redirect(303, `${page}?${new URLSearchParams({ google: outcome }).toString()}`)
  }
  if (!state) {
    back("failed")
    return
  }
  if ((await planModeFor(req.scope)) !== "open") {
    await dropGoogleStateWorkflow(req.scope).run({ input: { state } })
    back("restricted")
    return
  }
  if (error || !code) {
    await dropGoogleStateWorkflow(req.scope).run({ input: { state } })
    back(error === "access_denied" ? "denied" : "failed")
    return
  }
  try {
    // A user's session only: a customer's or an integration key's is no staff member
    const actor = (req as { auth_context?: { actor_type?: string; actor_id?: string } })
      .auth_context
    await finishGoogleConnectWorkflow(req.scope).run({
      input: {
        state,
        code,
        user_id: actor?.actor_type === "user" ? (actor.actor_id ?? null) : null,
      },
    })
  } catch (failure) {
    logger.warn({ event: "google.connect_failed", err: errorSummary(failure) })
    back(isValidationError(failure) ? failure.safeMessage.replace(/^google\./, "") : "failed")
    return
  }
  if (state.startsWith(REVIEWS_STATE_PREFIX)) {
    await adoptOnlyGoogleLocation(req.scope)
  }
  back("connected")
}
