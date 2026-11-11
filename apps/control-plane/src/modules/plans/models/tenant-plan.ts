import { model } from "@medusajs/framework/utils"
import { Package } from "./package"

/**
 * The package a shop is on (adr/0061 Ek C7): one per shop, by its id in
 * the tenants module. The subscription (C16) starts from it and keeps its
 * own copy of the price and period; this row says which package's limits
 * apply.
 */
export const TenantPlan = model
  .define("tenant_plan", {
    id: model.id({ prefix: "tenpl" }).primaryKey(),
    tenant_id: model.text(),
    assigned_by: model.text().nullable(),
    package: model.belongsTo(() => Package, { mappedBy: "tenants" }),
  })
  .indexes([
    { on: ["tenant_id"], unique: true, where: "deleted_at IS NULL" },
    { on: ["package_id"], where: "deleted_at IS NULL" },
  ])
