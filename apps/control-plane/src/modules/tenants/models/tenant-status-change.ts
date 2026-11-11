import { model } from "@medusajs/framework/utils"
import { TENANT_STATUSES } from "@qticaret/types/control-plane"
import { Tenant } from "./tenant"

/**
 * One move in a shop's lifecycle (adr/0061 §2): from (none when the record
 * was made) and to, why (a code), and who: a staff member's user id or
 * `system`. Only added to.
 */
export const TenantStatusChange = model
  .define("tenant_status_change", {
    id: model.id({ prefix: "tensc" }).primaryKey(),
    from_status: model.enum([...TENANT_STATUSES]).nullable(),
    to_status: model.enum([...TENANT_STATUSES]),
    reason_code: model.text(),
    actor: model.text(),
    /** Why, in the staff member's words (a suspension and its end, Ek C15); none for the system. */
    note: model.text().nullable(),
    tenant: model.belongsTo(() => Tenant, { mappedBy: "status_changes" }),
  })
  .indexes([{ on: ["tenant_id", "created_at"], where: "deleted_at IS NULL" }])
