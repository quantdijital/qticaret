import { model } from "@medusajs/framework/utils"
import { Package } from "./package"

/**
 * A package's value for one `owner: platform` flag (adr/0061 §2, Ek C9):
 * a key of the shared list (`PLATFORM_FLAGS`) and on/off. A flag without a
 * row takes the list's default.
 */
export const PackageFeature = model
  .define("package_feature", {
    id: model.id({ prefix: "pkgft" }).primaryKey(),
    key: model.text(),
    enabled: model.boolean(),
    package: model.belongsTo(() => Package, { mappedBy: "features" }),
  })
  .indexes([{ on: ["package_id", "key"], unique: true, where: "deleted_at IS NULL" }])
