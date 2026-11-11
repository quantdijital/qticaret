import { model } from "@medusajs/framework/utils"
import { Tenant } from "./tenant"

/** A staff note on a shop (adr/0061 §2): plain text up to 2000 characters, pinnable. */
export const TenantNote = model
  .define("tenant_note", {
    id: model.id({ prefix: "tennt" }).primaryKey(),
    body: model.text(),
    pinned: model.boolean().default(false),
    author_id: model.text().nullable(),
    tenant: model.belongsTo(() => Tenant, { mappedBy: "notes" }),
  })
  .indexes([{ on: ["tenant_id", "created_at"], where: "deleted_at IS NULL" }])
