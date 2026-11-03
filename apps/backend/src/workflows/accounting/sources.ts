import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { CancelInput, MoneyInput, SaleInput } from "../../lib/accounting"
import { turkishDay } from "../../lib/dashboard"
import { ValidationError } from "../../lib/errors"
import { fromMedusaAmount, sumKurus, toMedusaAmount } from "../../lib/money"
import type { MedusaAmount } from "../../lib/money"
import { methodOf, vatBreakdown } from "../../lib/reports/finance"
import type { FinanceOrder } from "../../lib/reports/finance"
import { ACCOUNTING_MODULE } from "../../modules/accounting"
import type AccountingModuleService from "../../modules/accounting/service"
import type { SyncSource } from "../../modules/accounting/service"
import { giftLineIdsOf } from "../gift-cards/gift-marks"

/**
 * A corporate buyer as a sale names it. Its tax id is not here: it is read
 * when the sale is sent (sync-record.ts), so it never sits in what a
 * workflow step returns and the engine keeps.
 */
export type SaleParty =
  | { kind: "individual" }
  | {
      kind: "corporate"
      customer_id: string
      profile_id: string
      name: string
      tax_office: string | null
    }

type Sale = Omit<SaleInput, "reference" | "customer"> & { party: SaleParty }
type Money = Omit<MoneyInput, "reference">
type Cancel = Omit<CancelInput, "reference">

/** What a record sends, or why it sends nothing. */
export type Source =
  | { kind: "sale"; sale: Sale }
  | { kind: "payment" | "refund"; money: Money }
  | { kind: "cancel"; cancel: Cancel }
  | { kind: "skip"; code: string }

interface OrderRow extends FinanceOrder {
  items?:
    | (
        | (NonNullable<NonNullable<FinanceOrder["items"]>[number]> & {
            id: string
            product_id?: string | null
            metadata?: unknown
          })
        | null
      )[]
    | null
  display_id: number
  status: string
  currency_code: string
  created_at: string | Date
  canceled_at: string | Date | null
  customer_id: string | null
  customer?: {
    billing_profile?: {
      id: string
      type: string
      legal_name: string
      tax_office: string | null
      tax_id_kind: string
    } | null
  } | null
}

const orderOf = async (container: MedusaContainer, orderId: string, fields: string[]) => {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields,
    filters: { id: orderId },
  })
  const order = data[0] as unknown as OrderRow | undefined
  if (!order) {
    throw new ValidationError("accounting.source_missing")
  }
  return order
}

/**
 * A sale as the order stands now. A canceled order is no sale (the monthly
 * package leaves it out too), nor is one in another currency: the books
 * are kept in lira. Its gift card lines are no sale either: money taken
 * in advance (docs/mali-musavir-sorulari.md 3.2), whose payment the
 * program still gets; an order of nothing else sends no sale.
 */
async function saleOf(container: MedusaContainer, orderId: string): Promise<Source> {
  const order = await orderOf(container, orderId, [
    "id",
    "display_id",
    "status",
    "currency_code",
    "created_at",
    "canceled_at",
    "customer_id",
    "total",
    "items.id",
    "items.product_id",
    "items.metadata",
    "items.total",
    "items.tax_total",
    "items.tax_lines.rate",
    "shipping_methods.total",
    "shipping_methods.tax_total",
    "shipping_methods.tax_lines.rate",
    "customer.billing_profile.id",
    "customer.billing_profile.type",
    "customer.billing_profile.legal_name",
    "customer.billing_profile.tax_office",
    "customer.billing_profile.tax_id_kind",
  ])
  if (order.status === "canceled" || order.canceled_at) {
    return { kind: "skip", code: "accounting.order_canceled" }
  }
  if (order.currency_code.toLowerCase() !== "try") {
    return { kind: "skip", code: "accounting.currency_unsupported" }
  }
  const gifts = await giftLineIdsOf(container, order.items ?? [])
  const items = (order.items ?? []).filter((item) => item && !gifts.has(item.id))
  if (gifts.size > 0 && items.length === 0) {
    return { kind: "skip", code: "accounting.advance_only" }
  }
  const lines = vatBreakdown([{ ...order, items }])
  const profile = order.customer?.billing_profile
  const party: SaleParty =
    profile?.type === "corporate" && profile.tax_id_kind === "vkn" && order.customer_id
      ? {
          kind: "corporate",
          customer_id: order.customer_id,
          profile_id: profile.id,
          name: profile.legal_name,
          tax_office: profile.tax_office,
        }
      : { kind: "individual" }
  return {
    kind: "sale",
    sale: {
      order_display_id: order.display_id,
      day: turkishDay(new Date(order.created_at)),
      lines,
      total: toMedusaAmount(sumKurus(lines.map((line) => fromMedusaAmount(line.gross)))),
      party,
    },
  }
}

/**
 * A canceled order's sale, canceled in the program too, once the sale went
 * there. A sale still on its way is waited for (this record is tried
 * again); one that never went (skipped, stopped, never queued) leaves
 * nothing to cancel.
 */
async function cancelOf(
  container: MedusaContainer,
  adapter: string,
  orderId: string
): Promise<Source> {
  const sale = await container
    .resolve<AccountingModuleService>(ACCOUNTING_MODULE)
    .recordOf(adapter, "sale", orderId)
  if (sale?.status === "pending") {
    throw new ValidationError("accounting.sale_pending")
  }
  if (sale?.status !== "synced" || !sale.external_ref) {
    return { kind: "skip", code: "accounting.nothing_to_cancel" }
  }
  const order = await orderOf(container, orderId, ["id", "display_id", "canceled_at"])
  return {
    kind: "cancel",
    cancel: {
      sale: { external_id: sale.external_ref },
      order_display_id: order.display_id,
      day: turkishDay(order.canceled_at ? new Date(order.canceled_at) : new Date()),
    },
  }
}

async function moneyOf(
  container: MedusaContainer,
  kind: "payment" | "refund",
  id: string
): Promise<Source> {
  const payments = container.resolve(Modules.PAYMENT)
  const [move] =
    kind === "payment"
      ? await payments.listCaptures({ id }, { relations: ["payment"], take: 1 })
      : await payments.listRefunds({ id }, { relations: ["payment"], take: 1 })
  const paymentId = (move as { payment?: { id?: string } | null } | undefined)?.payment?.id
  if (!move || !paymentId) {
    throw new ValidationError("accounting.source_missing")
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "payment",
    fields: [
      "provider_id",
      `${kind === "payment" ? "captures" : "refunds"}.id`,
      `${kind === "payment" ? "captures" : "refunds"}.amount`,
      `${kind === "payment" ? "captures" : "refunds"}.created_at`,
      "payment_collection.order.display_id",
    ],
    filters: { id: paymentId },
  })
  const payment = data[0] as unknown as
    | {
        provider_id: string
        captures?: { id: string; amount: MedusaAmount; created_at: string | Date }[]
        refunds?: { id: string; amount: MedusaAmount; created_at: string | Date }[]
        payment_collection?: { order?: { display_id: number } | null } | null
      }
    | undefined
  const row = (kind === "payment" ? payment?.captures : payment?.refunds)?.find(
    (entry) => entry.id === id
  )
  if (!payment || !row) {
    throw new ValidationError("accounting.source_missing")
  }
  return {
    kind,
    money: {
      order_display_id: payment.payment_collection?.order?.display_id ?? null,
      day: turkishDay(new Date(row.created_at)),
      method: methodOf(payment.provider_id),
      amount: toMedusaAmount(fromMedusaAmount(row.amount, { allowRounding: true })),
    },
  }
}

/** What the program is sent for a record: read now, so it says what the shop has now. */
export function sourceOf(
  container: MedusaContainer,
  input: { adapter: string; source_type: SyncSource; source_id: string }
): Promise<Source> {
  switch (input.source_type) {
    case "sale":
      return saleOf(container, input.source_id)
    case "cancel":
      return cancelOf(container, input.adapter, input.source_id)
    case "payment":
    case "refund":
      return moneyOf(container, input.source_type, input.source_id)
  }
}
