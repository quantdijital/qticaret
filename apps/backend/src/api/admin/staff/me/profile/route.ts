import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../../../../lib/errors"
import { profileOf, updateStaffProfileWorkflow } from "../../../../../workflows/staff/account"
import { pendingEmailChange } from "../../../../../workflows/staff/email-change"
import type { AdminPostStaffProfileType } from "../../validators"

async function answer(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const userId = req.auth_context.actor_id
  const profile = await profileOf(req.scope, userId)
  if (!profile) {
    throw new ValidationError("staff.unknown")
  }
  const pending = await pendingEmailChange(userId)
  res.json({
    profile,
    // Their own ask, to them alone: the address they typed and until when its link holds
    pending_email: pending
      ? { to: pending.to, expires_at: new Date(pending.expires_at).toISOString() }
      : null,
  })
}

/**
 * GET /admin/staff/me/profile (the owner, 2026-11-06): the signed-in
 * member's own profile, whatever their role: name, job title, role,
 * address, since when, and an address change waiting for its link.
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
