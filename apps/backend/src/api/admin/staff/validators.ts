import { z } from "@medusajs/framework/zod"
import { INVITABLE_ROLES, STAFF_ROLES } from "../../../lib/staff"
import { MAX_JOB_TITLE } from "../../../lib/staff/account"
import { isCleanText } from "../../../lib/security/text"

const token = z.string().min(16).max(4096)
const name = z.string().trim().min(1, "staff.name_required").max(100)

/** A member's new role (the owner's change; the last owner keeps theirs). */
export const AdminPostStaffRole = z.object({ role: z.enum(STAFF_ROLES) }).strict()
export type AdminPostStaffRoleType = z.infer<typeof AdminPostStaffRole>

/** An invitation: the address and the role it gives; an owner is made from the team. */
export const AdminPostStaffInvite = z
  .object({
    email: z
      .email({ error: "staff.email_invalid" })
      .max(254)
      .transform((value) => value.trim().toLowerCase()),
    role: z.enum(INVITABLE_ROLES),
  })
  .strict()
export type AdminPostStaffInviteType = z.infer<typeof AdminPostStaffInvite>

/** An invitation accepted: its token and the name the new member gives. */
export const AdminPostStaffAccept = z.object({ token, first_name: name, last_name: name }).strict()
export type AdminPostStaffAcceptType = z.infer<typeof AdminPostStaffAccept>

export const AdminPostStaffInviteInfo = z.object({ token }).strict()
export type AdminPostStaffInviteInfoType = z.infer<typeof AdminPostStaffInviteInfo>

/** A member's 2FA reset names nothing but the member in its path. */
export const AdminPostStaffResetMfa = z.object({}).strict()

// One's own account (the owner, 2026-11-06): a password is taken as typed, never trimmed
const password = z.string().min(1).max(1024)
const address = z
  .email({ error: "staff.email_invalid" })
  .max(254)
  .transform((value) => value.trim().toLowerCase())

/** One's own name and job title; an empty title takes it off. */
export const AdminPostStaffProfile = z
  .object({
    first_name: name,
    last_name: name,
    job_title: z
      .string()
      .trim()
      .max(MAX_JOB_TITLE)
      .refine((value) => isCleanText(value), "staff.job_title_invalid")
      .nullish()
      .transform((value) => (value === "" || value === undefined ? null : value)),
  })
  .strict()
export type AdminPostStaffProfileType = z.infer<typeof AdminPostStaffProfile>

/** One's own password: the current one and the new one (the rule is the workflow's). */
export const AdminPostStaffPassword = z
  .object({ current_password: password, new_password: password })
  .strict()
export type AdminPostStaffPasswordType = z.infer<typeof AdminPostStaffPassword>

/** One's own login address: the new one, and the current password. */
export const AdminPostStaffEmail = z.object({ email: address, current_password: password }).strict()
export type AdminPostStaffEmailType = z.infer<typeof AdminPostStaffEmail>

/** The new address's link, as the panel's page read it. */
export const AdminPostStaffEmailConfirm = z.object({ token }).strict()
export type AdminPostStaffEmailConfirmType = z.infer<typeof AdminPostStaffEmailConfirm>

/** One's other sessions ended: nothing but the caller. */
export const AdminPostStaffEndSessions = z.object({}).strict()
