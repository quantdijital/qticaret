import { model } from "@medusajs/framework/utils"

/**
 * A tenant's choice for a feature flag where it differs from the flag's
 * default (adr/0012); flags themselves are defined in code (`features.ts`).
 */
export const FeatureOverride = model.define("platform_feature_override", {
  id: model.id({ prefix: "pfeat" }).primaryKey(),
  key: model.text().unique(),
  enabled: model.boolean(),
  updated_by: model.text().nullable(),
})
