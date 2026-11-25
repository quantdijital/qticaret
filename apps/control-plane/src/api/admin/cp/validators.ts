import { z } from "@medusajs/framework/zod"
import { CP_INVITABLE_ROLES, CP_STAFF_ROLES } from "../../../lib/staff/roles"
import { CLEAN } from "../../../lib/clean-text"

const token = z.string().min(16).max(4096)
const name = z.string().trim().min(1, "cp.name_required").max(100).regex(CLEAN, "cp.name_invalid")
const email = z
  .email({ error: "cp.email_invalid" })
  .max(254)
  .transform((value) => value.trim().toLowerCase())
// A password is taken as typed, never trimmed
const password = z.string().min(1).max(1024)
const code = z.string().trim().min(1).max(64)

export const NoBody = z.object({}).strict()

/** One's own name. */
export const PostCpMe = z.object({ first_name: name, last_name: name }).strict()
export type PostCpMeType = z.infer<typeof PostCpMe>

/** The setup's first code and the password: no session alone sets up 2FA. */
export const PostCpMfaVerify = z
  .object({
    code,
    password,
    // After a 2FA reset: the e-mailed, single-use enrolment link's token (M3)
    enrolment_token: z.string().min(16).max(256).optional(),
  })
  .strict()
export type PostCpMfaVerifyType = z.infer<typeof PostCpMfaVerify>

/** Proving oneself again: an app code or a recovery code. */
export const PostCpStepUp = z.object({ method: z.enum(["totp", "recovery_code"]), code }).strict()
export type PostCpStepUpType = z.infer<typeof PostCpStepUp>

/** An invitation: the address and the role it gives, an owner's too (adr/0061 §3.5). */
export const PostCpInvite = z.object({ email, role: z.enum(CP_INVITABLE_ROLES) }).strict()
export type PostCpInviteType = z.infer<typeof PostCpInvite>

/** A member's new role. */
export const PostCpMemberRole = z.object({ role: z.enum(CP_STAFF_ROLES) }).strict()
export type PostCpMemberRoleType = z.infer<typeof PostCpMemberRole>

export const PostCpInviteInfo = z.object({ token }).strict()
export type PostCpInviteInfoType = z.infer<typeof PostCpInviteInfo>

/** An invitation accepted: its token and the name the new member gives. */
export const PostCpInviteAccept = z.object({ token, first_name: name, last_name: name }).strict()
export type PostCpInviteAcceptType = z.infer<typeof PostCpInviteAccept>

/** The audit log, newest first, a page at a time. */
export const GetCpAuditLog = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
    actor_id: z.string().min(1).max(256).optional(),
    resource_type: z.string().min(1).max(64).optional(),
  })
  .strict()
export type GetCpAuditLogType = z.infer<typeof GetCpAuditLog>

export const NoQuery = z.object({}).strict()
