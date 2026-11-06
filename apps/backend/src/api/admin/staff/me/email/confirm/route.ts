import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { parseKey } from "../../../../../../lib/crypto/pii"
import { parseEnv } from "../../../../../../lib/env"
import { ValidationError } from "../../../../../../lib/errors"
import { openEmailChange } from "../../../../../../lib/staff/account"
import { confirmStaffEmailChangeWorkflow } from "../../../../../../workflows/staff/email-change"
import type { AdminPostStaffEmailConfirmType } from "../../../validators"

// A confirmation waits this long for another of the same member's to finish
const LOCK_TIMEOUT_S = 10

/**
 * POST /admin/staff/me/email/confirm (the owner, 2026-11-06; security
 * review 2026-11-06): the link sent to a member's new address, confirmed
 * by that member signed in: a link someone else asked for, or one opened
 * by whoever reads a mistyped inbox, moves nothing. Opened here, so no
 * workflow carries the token; one confirmation at a time per member.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostStaffEmailConfirmType>,
  res: MedusaResponse
): Promise<void> {
  const userId = req.auth_context.actor_id
  const claim = openEmailChange(
    req.validatedBody.token,
    parseKey(parseEnv().PII_ENCRYPTION_KEY, "PII_ENCRYPTION_KEY")
  )
  if (claim?.user_id !== userId) {
    throw new ValidationError("staff.email_change_invalid")
  }
  await req.scope
    .resolve(Modules.LOCKING)
    .execute(
      `staff:email-change:${userId}`,
      () => confirmStaffEmailChangeWorkflow(req.scope).run({ input: { user_id: userId, claim } }),
      { timeout: LOCK_TIMEOUT_S }
    )
  res.json({ changed: true })
}
