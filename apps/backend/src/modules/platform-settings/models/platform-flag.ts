import { model } from "@medusajs/framework/utils"

/**
 * An `owner: platform` flag's value as the control plane's plan document
 * sets it (adr/0012, adr/0061 §5.2, Ek C9). Written only by the document's
 * workflow (`syncPlatformFlags`), never from the panel; apart from the
 * shop's own choices (`platform_feature_override`), which never apply to
 * a platform flag. Read only while the shop is managed: unmanaged, every
 * platform flag is at its default whatever is stored here.
 */
export const PlatformFlag = model.define("platform_flag", {
  id: model.id({ prefix: "pflag" }).primaryKey(),
  key: model.text().unique(),
  enabled: model.boolean(),
})
