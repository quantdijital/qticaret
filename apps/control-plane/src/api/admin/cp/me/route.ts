import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { updateUsersWorkflow } from "@medusajs/medusa/core-flows"
import { cpStaff, hasEnabledFactor, mfaEnforced, mfaPassed } from "../../../http/caller"
import type { PostCpMeType } from "../validators"

async function profileOf(req: AuthenticatedMedusaRequest) {
  const { actor_id: userId, auth_identity_id: identity } = req.auth_context
  const [user] = await req.scope
    .resolve(Modules.USER)
    .listUsers({ id: userId }, { select: ["id", "email", "first_name", "last_name"], take: 1 })
  return {
    id: userId,
    email: user?.email ?? null,
    first_name: user?.first_name ?? null,
    last_name: user?.last_name ?? null,
    role: await cpStaff(req).roleOf(userId),
    mfa: {
      required: mfaEnforced(),
      enabled: identity ? await hasEnabledFactor(req, identity) : false,
      passed: await mfaPassed(req),
    },
  }
}

/**
 * GET /admin/cp/me (adr/0061 §3.5): the signed-in member, their role, and
 * where they stand with 2FA, which the panel reads to lead them to the
 * setup. Reachable before 2FA is passed; the API decides again everywhere.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ me: await profileOf(req) })
}

/** POST /admin/cp/me: one's own name. */
export async function POST(
  req: AuthenticatedMedusaRequest<PostCpMeType>,
  res: MedusaResponse
): Promise<void> {
  const { first_name, last_name } = req.validatedBody
  await updateUsersWorkflow(req.scope).run({
    input: { updates: [{ id: req.auth_context.actor_id, first_name, last_name }] },
  })
  res.json({ me: await profileOf(req) })
}
