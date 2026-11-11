import { model } from "@medusajs/framework/utils"
import { LIMIT_KEYS } from "@qticaret/types/control-plane"

/**
 * A shop's own value for one limit, over its package's (adr/0061 §2): with
 * the reason it was given and, optionally, when it ends. Null for no
 * limit. A platform flag's exception is `tenant_feature_override` (C9).
 */
export const TenantOverride = model
  .define("tenant_override", {
    id: model.id({ prefix: "tenov" }).primaryKey(),
    tenant_id: model.text(),
    key: model.enum([...LIMIT_KEYS]),
    value: model.number().nullable(),
    reason: model.text(),
    expires_at: model.dateTime().nullable(),
    created_by: model.text().nullable(),
  })
  .indexes([{ on: ["tenant_id", "key"], unique: true, where: "deleted_at IS NULL" }])
