import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { errorSummary, logger } from "../../../lib/logging"
import { isValidationError } from "../../../lib/errors"
import { GOOGLE_PANEL_PATH } from "../../../lib/google/oauth"
import { planModeFor } from "../../../lib/plan-guard"
import {
  dropGoogleStateWorkflow,
  finishGoogleConnectWorkflow,
} from "../../../workflows/google/connect"
import type { GoogleCallbackQueryType } from "../../admin/google/validators"

/**
 * GET /google/callback (F10 M13): where Google sends the staff member back
 * from its consent screen. The `state` names the connection under way
 * (used once, by the staff member signed in who started it); the code
 * becomes the shop's refresh token. Whatever happens, the browser goes
 * back to Settings > Marketing with one word of outcome.
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
    res.redirect(303, `${GOOGLE_PANEL_PATH}?${new URLSearchParams({ google: outcome }).toString()}`)
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
  back("connected")
}
