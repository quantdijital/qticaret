import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { capabilitiesOf } from "../../../../lib/staff"
import { mfaAvailable, mfaPassed, mfaRequired, staffRoleOf } from "../../../http/staff-guard"

/**
 * GET /admin/staff/me (F12.6, adr/0040): the signed-in staff member's role,
 * what the panel may offer them, and where they stand with 2FA: whether
 * this environment can ask it, whether the shop requires it, whether they
 * set it up, and whether this session passed it. The API decides again
 * on every request.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const role = (await staffRoleOf(req)) ?? null
  const identity = req.auth_context.auth_identity_id
  const factors = identity
    ? await req.scope
        .resolve(Modules.AUTH)
        .listAuthMfa({ auth_identity_id: identity, status: "enabled" }, { select: ["id"] })
    : []
  res.json({
    user_id: req.auth_context.actor_id,
    role,
    can: capabilitiesOf(role),
    mfa: {
      available: mfaAvailable(),
      required: await mfaRequired(req),
      enabled: factors.length > 0,
      passed: mfaPassed(req),
    },
  })
}
