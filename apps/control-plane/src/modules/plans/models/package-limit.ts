import { model } from "@medusajs/framework/utils"
import { LIMIT_KEYS } from "@qticaret/types/control-plane"
import { Package } from "./package"

/** One of a package's limits (adr/0061 §2): a registry key and its value, null for no limit. */
export const PackageLimit = model
  .define("package_limit", {
    id: model.id({ prefix: "pkglm" }).primaryKey(),
    key: model.enum([...LIMIT_KEYS]),
    value: model.number().nullable(),
    package: model.belongsTo(() => Package, { mappedBy: "limits" }),
  })
  .indexes([{ on: ["package_id", "key"], unique: true, where: "deleted_at IS NULL" }])
