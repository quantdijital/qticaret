import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { errorSummary, logger } from "../../../lib/logging"
import { isValidationError } from "../../../lib/errors"
import {
  dropGoogleStateWorkflow,
  finishGoogleConnectWorkflow,
} from "../../../workflows/google/connect"
import type { GoogleCallbackQueryType } from "../../admin/google/validators"

/** The panel's page the staff member returns to, on the same host (adr/0022 §4). */
const BACK = "/settings/marketing"

/**
 * GET /google/callback (F10 M13): where Google sends the staff member back
 * from its consent screen. The `state` names the connection under way
 * (used once, by the staff member signed in who started it); the code
 * becomes the shop's refresh token. Whatever happens, the browser goes
 * back to the panel with one word of outcome.
 */
export async function GET(
  req: MedusaRequest<unknown, GoogleCallbackQueryType>,
  res: MedusaResponse
): Promise<void> {
  const { state, code, error } = req.validatedQuery as GoogleCallbackQueryType
  const back = (outcome: string) => {
    res.redirect(303, `${BACK}?${new URLSearchParams({ google: outcome }).toString()}`)
  }
  if (!state) {
    back("failed")
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
    back("connected")
  } catch (failure) {
    logger.warn({ event: "google.connect_failed", err: errorSummary(failure) })
    back(isValidationError(failure) ? failure.safeMessage.replace(/^google\./, "") : "failed")
  }
}
