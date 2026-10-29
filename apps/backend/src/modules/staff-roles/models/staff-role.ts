import { model } from "@medusajs/framework/utils"
import { STAFF_ROLES } from "../../../lib/staff/permissions"

/**
 * A staff member's role (F12.6, adr/0040): one per user. A user without a
 * row reads as `readonly`; the shop always keeps at least one `owner`.
 */
export const StaffRole = model
  .define("staff_role", {
    id: model.id({ prefix: "strole" }).primaryKey(),
    user_id: model.text(),
    role: model.enum([...STAFF_ROLES]),
    /** Who gave it: a user, or null for the system (first owner, migration). */
    assigned_by: model.text().nullable(),
  })
  .indexes([{ on: ["user_id"], unique: true, where: "deleted_at IS NULL" }])
