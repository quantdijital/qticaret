import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { planModeFor, shownStatusOf } from "../../../../lib/plan-guard"
import { capabilitiesOf } from "../../../../lib/staff"
import { supportCapabilities } from "../../../../lib/support-access/permissions"
import { supportView } from "../../../../lib/support-access/session"
import { mfaAvailable, mfaPassed, mfaRequired, staffRoleOf } from "../../../http/staff-guard"
import { openSupportSessionOf } from "../../../http/support-guard"

/**
 * GET /admin/staff/me (F12.6, adr/0040): the signed-in staff member's role,
 * what the panel may offer them, and where they stand with 2FA: whether
 * this environment can ask it, whether the shop requires it, whether they
 * set it up, and whether this session passed it. The API decides again
 * on every request. And the shop's status (adr/0061 Ek C15), for every
 * role: the panel's strip says when writes are closed. `GET /admin/plan`
 * stays the owner's and admins' (billing is not every role's business).
 * A support session answers as `admin` with its own `can` and `support`.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  // A support session (adr/0061 Ek "Destek erişimi"): no role, login or 2FA of its own; its
  // reach is its list's, and the panel's strip reads who, why and until when
  const support = openSupportSessionOf(req)
  if (support) {
    res.json({
      user_id: support.actor_id,
      role: "admin",
      can: supportCapabilities(),
      mfa: { available: mfaAvailable(), required: false, enabled: false, passed: true },
      plan: { status: shownStatusOf(await planModeFor(req.scope)) },
      support: supportView(support),
    })
    return
  }
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
    plan: { status: shownStatusOf(await planModeFor(req.scope)) },
  })
}
