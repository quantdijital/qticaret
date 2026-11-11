import { model } from "@medusajs/framework/utils"
import { CONTACT_ROLES } from "../../../lib/tenants/kinds"
import { Tenant } from "./tenant"

/**
 * A person at the shop the platform deals with (adr/0061 §2): personal
 * data of our customer's staff, the platform the controller
 * (docs/kvkk-envanter.md). One is the primary billing contact: the payment
 * reminders go to them (C16). Removed for good when removed: no soft
 * delete keeps a person's address around.
 */
export const TenantContact = model
  .define("tenant_contact", {
    id: model.id({ prefix: "tenct" }).primaryKey(),
    name: model.text(),
    role: model.enum([...CONTACT_ROLES]),
    email: model.text(),
    /** E.164 (`+905321234567`). */
    phone: model.text().nullable(),
    is_primary_billing: model.boolean().default(false),
    tenant: model.belongsTo(() => Tenant, { mappedBy: "contacts" }),
  })
  .indexes([
    { on: ["tenant_id"], where: "deleted_at IS NULL" },
    {
      name: "IDX_tenant_contact_primary_billing",
      on: ["tenant_id"],
      unique: true,
      where: "is_primary_billing = true AND deleted_at IS NULL",
    },
  ])
