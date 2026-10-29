import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { PeriodWindow } from "../../../../lib/dashboard"
import { kurus, toMedusaAmount } from "../../../../lib/money"
import { collections, vatBreakdown } from "../../../../lib/reports/finance"
import type { FinanceOrder } from "../../../../lib/reports/finance"
import { CHARGEBACKS_MODULE } from "../../../../modules/chargebacks"
import type ChargebacksModuleService from "../../../../modules/chargebacks/service"
import { ordersBetween } from "../../dashboard/orders"
import { MAX_REPORT_ORDERS, cached } from "../../dashboard/overview/read"

// The root total makes the order module compute the lines' totals (Medusa 2.21.2)
const FIELDS = [
  "id",
  "status",
  "currency_code",
  "total",
  "items.total",
  "items.tax_total",
  "items.tax_lines.rate",
  "shipping_methods.total",
  "shipping_methods.tax_total",
  "shipping_methods.tax_lines.rate",
  "payment_collections.payments.provider_id",
  "payment_collections.payments.captures.amount",
  "payment_collections.payments.refunds.amount",
]

/**
 * The finance report (F11.3, adr/0039 §3) over a window: sales by VAT
 * rate, money taken and given back by payment method, and the disputes
 * opened in it. Orders in lira, canceled ones left out; nothing personal.
 */
export async function computeFinanceReport(scope: MedusaContainer, window: PeriodWindow) {
  const page = await ordersBetween<FinanceOrder & { status: string; currency_code: string }>(
    scope,
    FIELDS,
    window.from,
    window.to,
    MAX_REPORT_ORDERS
  )
  const sold = page.rows.filter(
    (order) => order.status !== "canceled" && order.currency_code === "try"
  )
  const disputes = await scope
    .resolve<ChargebacksModuleService>(CHARGEBACKS_MODULE)
    .listChargebacks(
      { created_at: { $gte: window.from, $lt: window.to } },
      { order: { created_at: "ASC" }, take: 1_000 }
    )
  const { data: orders } = disputes.length
    ? await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "order",
        fields: ["id", "display_id"],
        filters: { id: [...new Set(disputes.map((dispute) => dispute.order_id))] },
      })
    : { data: [] }
  const numbers = new Map(
    (orders as unknown as { id: string; display_id: number | string }[]).map((order) => [
      order.id,
      Number(order.display_id),
    ])
  )
  return {
    period: { key: window.key, from: window.from.toISOString(), to: window.to.toISOString() },
    currency_code: "try",
    capped: page.count > page.rows.length,
    vat: vatBreakdown(sold),
    payments: collections(sold),
    chargebacks: disputes.map((dispute) => ({
      id: dispute.id,
      order_display_id: numbers.get(dispute.order_id) ?? null,
      provider: dispute.provider,
      reason: dispute.reason,
      status: dispute.status,
      amount: toMedusaAmount(kurus(dispute.amount)),
      opened_at: new Date(dispute.created_at).toISOString(),
      due_at: dispute.due_at ? new Date(dispute.due_at).toISOString() : null,
    })),
  }
}

export type FinanceReport = Awaited<ReturnType<typeof computeFinanceReport>>

const finance = cached(computeFinanceReport)

export const readFinanceReport = finance.read

/** Tests start from an empty cache. */
export const clearFinanceCache = finance.clear
