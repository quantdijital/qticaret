import { model } from "@medusajs/framework/utils"

/**
 * A shop's own value for one platform flag, over its package's (adr/0061
 * §2, Ek C9): beside the limit exceptions (`tenant_override`), with the
 * same reason and optional end. Its own table: a flag is on/off, a limit a
 * number, and neither table's checks loosen for the other.
 */
export const TenantFeatureOverride = model
  .define("tenant_feature_override", {
    id: model.id({ prefix: "tenfo" }).primaryKey(),
    tenant_id: model.text(),
    key: model.text(),
    enabled: model.boolean(),
    reason: model.text(),
    expires_at: model.dateTime().nullable(),
    created_by: model.text().nullable(),
  })
  .indexes([{ on: ["tenant_id", "key"], unique: true, where: "deleted_at IS NULL" }])
