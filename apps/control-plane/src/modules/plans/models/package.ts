import { model } from "@medusajs/framework/utils"
import { BILLING_PERIODS } from "@qticaret/types/control-plane"
import { PackageFeature } from "./package-feature"
import { PackageLimit } from "./package-limit"
import { TenantPlan } from "./tenant-plan"

/**
 * A package the platform sells (adr/0061 §2): its code (fixed once made:
 * the plan document names it), name, price in kuruş (TRY) per period, the
 * trial and grace days a subscription starts with, and its limits. An
 * archived package stays on the shops that have it and is offered to no
 * new one.
 */
export const Package = model
  .define("package", {
    id: model.id({ prefix: "pkg" }).primaryKey(),
    code: model.text(),
    name: model.text(),
    /** Kuruş, TRY (`149000` = 1.490,00 TL), as quoted to the shop. */
    price: model.number(),
    currency_code: model.text().default("TRY"),
    period: model.enum([...BILLING_PERIODS]),
    trial_days: model.number().default(0),
    grace_days: model.number().default(7),
    archived_at: model.dateTime().nullable(),
    limits: model.hasMany(() => PackageLimit, { mappedBy: "package" }),
    /** Its platform flags (Ek C9); a flag without a row takes the list's default. */
    features: model.hasMany(() => PackageFeature, { mappedBy: "package" }),
    tenants: model.hasMany(() => TenantPlan, { mappedBy: "package" }),
  })
  .indexes([{ on: ["code"], unique: true, where: "deleted_at IS NULL" }])
  .cascades({ delete: ["limits", "features"] })
