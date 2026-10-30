import { z } from "@medusajs/framework/zod"
import { INVITABLE_ROLES, STAFF_ROLES } from "../../../lib/staff"

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
