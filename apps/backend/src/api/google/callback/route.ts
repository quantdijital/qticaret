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
 * (used once); the code becomes the shop's refresh token. Whatever
 * happens, the browser goes back to the panel with one word of outcome.
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
    await finishGoogleConnectWorkflow(req.scope).run({ input: { state, code } })
    back("connected")
  } catch (failure) {
    logger.warn({ event: "google.connect_failed", err: errorSummary(failure) })
    back(isValidationError(failure) ? failure.safeMessage.replace(/^google\./, "") : "failed")
  }
}
