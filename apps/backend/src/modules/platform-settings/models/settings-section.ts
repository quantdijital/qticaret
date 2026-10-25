import { model } from "@medusajs/framework/utils"

/**
 * One settings section (adr/0012: `store`, `seo`; `legal_info` in F13), its
 * values checked against the section's schema in code. There is no free
 * key/value storage, so no secret can be put here.
 */
export const SettingsSection = model.define("platform_settings_section", {
  id: model.id({ prefix: "psec" }).primaryKey(),
  section: model.text().unique(),
  values: model.json(),
  version: model.number().default(1),
  updated_by: model.text().nullable(),
})
