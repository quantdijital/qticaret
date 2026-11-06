import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../../../../lib/errors"
import { profileOf, updateStaffProfileWorkflow } from "../../../../../workflows/staff/account"
import { openSessionCount } from "../../../../http/staff-sessions"
import type { AdminPostStaffProfileType } from "../../validators"

async function answer(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const userId = req.auth_context.actor_id
  const profile = await profileOf(req.scope, userId)
  if (!profile) {
    throw new ValidationError("staff.unknown")
  }
  res.json({ profile, sessions: { open: await openSessionCount(req, userId) } })
}

/**
 * GET /admin/staff/me/profile (the owner, 2026-11-06): the signed-in
 * member's own profile, whatever their role: name, job title, role,
 * address, since when; and how many panel sessions they have open.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  await answer(req, res)
}

/** POST /admin/staff/me/profile: their own name and job title; nobody else's. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostStaffProfileType>,
  res: MedusaResponse
): Promise<void> {
  await updateStaffProfileWorkflow(req.scope).run({
    input: { ...req.validatedBody, user_id: req.auth_context.actor_id },
  })
  await answer(req, res)
}
