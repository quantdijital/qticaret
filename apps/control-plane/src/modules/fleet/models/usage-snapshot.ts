import { model } from "@medusajs/framework/utils"

/**
 * A shop's usage report as received (adr/0061 §2 `fleet`, §5.4, Ek C13):
 * totals only, never a person, an address, an e-mail, an order line or an
 * amount (the contract's strict schema could carry none; monthly revenue is
 * not sent, the owner's decision). One row an hour per shop, kept 90 days
 * (the retention job). `reported_at` is the shop's own time, strictly
 * growing per shop: an older or equal one is refused.
 */
export const UsageSnapshot = model
  .define("usage_snapshot", {
    id: model.id({ prefix: "usage" }).primaryKey(),
    tenant_id: model.text(),
    reported_at: model.dateTime(),
    received_at: model.dateTime(),
    /** The Turkish calendar month the monthly counts belong to, `YYYY-MM`. */
    period: model.text(),
    products: model.number(),
    orders_this_month: model.number(),
    staff: model.number(),
    storage_mb: model.number(),
    llm_credits_this_month: model.number(),
    last_order_at: model.dateTime().nullable(),
    release_version: model.text(),
    release_commit: model.text(),
    /** Ek C21: the shop's setup checklist, yes/no per step; null when its report carried none. */
    setup: model.json().nullable(),
  })
  .indexes([
    { on: ["tenant_id", "reported_at"], unique: true, where: "deleted_at IS NULL" },
    { name: "IDX_usage_snapshot_reported_at", on: ["reported_at"] },
  ])
