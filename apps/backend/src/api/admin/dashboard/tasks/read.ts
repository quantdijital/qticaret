import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { LIFECYCLE_FIELDS, lifecycleOf } from "../../../../lib/dashboard"
import type { LifecycleOrder } from "../../../../lib/dashboard"
import { actionableCount } from "../../../../lib/seo/setup-checklist"
import { lowStockThresholds } from "../../../../lib/stock"
import { ACCOUNTING_MODULE } from "../../../../modules/accounting"
import type AccountingModuleService from "../../../../modules/accounting/service"
import { PAYMENT_RECOVERY_MODULE } from "../../../../modules/payment-recovery"
import type PaymentRecoveryModuleService from "../../../../modules/payment-recovery/service"
import { TENANT_WEBHOOKS_MODULE } from "../../../../modules/tenant-webhooks"
import type TenantWebhooksModuleService from "../../../../modules/tenant-webhooks/service"
import { activeAccountingAdapter } from "../../../../workflows/accounting/active-adapter"
import { legalIdentity } from "../../../../workflows/legal/identity"
import { seoSetupChecklist } from "../../../../workflows/seo/setup-checklist"

// Open orders and stock records read at most (docs/04); past this the
// counts are floors and the answer says so
const MAX_READ = 2000

interface StockRow {
  id: string
  location_levels?:
    ({ stocked_quantity?: number | null; reserved_quantity?: number | null } | null)[] | null
}

const available = (row: StockRow): number =>
  (row.location_levels ?? []).reduce(
    (sum, level) => sum + (level?.stocked_quantity ?? 0) - (level?.reserved_quantity ?? 0),
    0
  )

/**
 * What waits for the shop (docs/17): orders to ship or still unpaid, stock
 * running low, products left as drafts, payments that became no order
 * (F5 V4); records the accounting program refused and hooks turned off
 * after failing (F12.1), null where the shop uses neither; SEO setup
 * items the shop can do now (F12.10); the legal identity's missing
 * details (F13.9). Counts only; no personal data.
 */
export async function readDashboardTasks(scope: MedusaContainer) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const recoveries = scope.resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
  const hooks = scope.resolve<TenantWebhooksModuleService>(TENANT_WEBHOOKS_MODULE)
  const accounting = await activeAccountingAdapter(scope)
  const [
    open,
    stock,
    drafts,
    [, refunding],
    [, byHand],
    [, hookCount],
    [, hooksOff],
    counts,
    seoSetup,
    identity,
  ] = await Promise.all([
    query.graph({
      entity: "order",
      fields: ["id", ...LIFECYCLE_FIELDS],
      filters: { status: ["pending", "requires_action"], is_draft_order: false },
      pagination: { skip: 0, take: MAX_READ },
    }),
    query.graph({
      entity: "inventory_item",
      fields: ["id", "location_levels.stocked_quantity", "location_levels.reserved_quantity"],
      pagination: { skip: 0, take: MAX_READ },
    }),
    query.graph({
      entity: "product",
      fields: ["id"],
      filters: { status: "draft" },
      pagination: { skip: 0, take: 1 },
    }),
    // F5 V4: payments that became no order, being given back or left to the shop
    recoveries.listAndCountPaymentRecoveries({ status: "pending" }, { select: ["id"], take: 1 }),
    recoveries.listAndCountPaymentRecoveries({ status: "failed" }, { select: ["id"], take: 1 }),
    hooks.listAndCountWebhookSubscriptions({}, { select: ["id"], take: 1 }),
    hooks.listAndCountWebhookSubscriptions({ status: "disabled" }, { select: ["id"], take: 1 }),
    accounting.adapter
      ? scope.resolve<AccountingModuleService>(ACCOUNTING_MODULE).counts(accounting.id)
      : Promise.resolve(null),
    // F12.10: the SEO setup items the shop can do now
    seoSetupChecklist(scope),
    // F13.9: what the legal identity still lacks
    legalIdentity(scope),
  ])
  const orders = open.data as LifecycleOrder[]
  const stages = orders.map((order) => lifecycleOf(order))
  const items = stock.data as StockRow[]
  const thresholds = await lowStockThresholds(
    scope,
    items.map((row) => row.id)
  )
  return {
    to_ship: stages.filter((stage) => stage === "to_ship").length,
    awaiting_payment: stages.filter((stage) => stage === "awaiting_payment").length,
    low_stock: items.filter((row) => available(row) <= thresholds.of(row.id)).length,
    low_stock_threshold: thresholds.fallback,
    draft_products: drafts.metadata?.count ?? drafts.data.length,
    orphan_payments: { refunding, by_hand: byHand },
    accounting_stopped: counts ? counts.stopped : null,
    webhooks_disabled: hookCount > 0 ? hooksOff : null,
    seo_setup_open: actionableCount(seoSetup),
    legal_identity_missing: identity.gaps.length,
    capped:
      (open.metadata?.count ?? 0) > orders.length || (stock.metadata?.count ?? 0) > items.length,
  }
}

export type DashboardTasks = Awaited<ReturnType<typeof readDashboardTasks>>
