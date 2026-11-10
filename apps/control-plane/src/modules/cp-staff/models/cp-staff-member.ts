import { model } from "@medusajs/framework/utils"
import { CP_STAFF_ROLES } from "../../../lib/staff/roles"

/**
 * A platform staff member's role (adr/0061 §3.5; the shop's staff-roles
 * module, copied): one per user. A user without a row, or a deactivated
 * one, reaches nothing. The control plane keeps one active owner at least.
 */
export const CpStaffMember = model
  .define("cp_staff_member", {
    id: model.id({ prefix: "cpstf" }).primaryKey(),
    user_id: model.text(),
    role: model.enum([...CP_STAFF_ROLES]),
    /** Who gave it: a user, or null for the system (`cp:create-owner`). */
    assigned_by: model.text().nullable(),
    /** Set when an owner takes the member's access away; their row and history stay. */
    deactivated_at: model.dateTime().nullable(),
  })
  .indexes([{ on: ["user_id"], unique: true, where: "deleted_at IS NULL" }])
