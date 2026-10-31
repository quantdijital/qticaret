import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { exchangeLines, exchangeOfLine, fakeInvoicingAllowed } from "../../lib/invoicing"
import { errorSummary, logger } from "../../lib/logging"
import { EINVOICE_MODULE } from "../../modules/einvoice"
import type EinvoiceModuleService from "../../modules/einvoice/service"
import { RETURN_REQUESTS_MODULE } from "../../modules/return-requests"
import type ReturnRequestsModuleService from "../../modules/return-requests/service"
import { exchangesOf } from "./draft-parts"
import { invoiceTotalsOf } from "./draft-source"
import { announceInvoice, invoicingOf } from "./queue-invoices"
import type { QueueOutcome } from "./queue-invoices"

type Container = Pick<MedusaContainer, "resolve">
type Rows<T> = (T | null)[] | null | undefined

/** An exchange's request once its goods came back: refunded too when the shop owed. */
export const EXCHANGE_CAME_BACK = ["received", "refunded"]

interface ExchangeOrderRow {
  status?: string | null
  canceled_at?: string | Date | null
  fulfillments?: Rows<{
    shipped_at?: string | Date | null
    canceled_at?: string | Date | null
    items?: Rows<{ line_item_id?: string | null }>
  }>
}

const requests = (container: Container) =>
  container.resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)

/** Whether a parcel carrying one of the lines has left. */
export function parcelLeftWith(
  order: Pick<ExchangeOrderRow, "fulfillments">,
  lineIds: Set<string>
) {
  return (order.fulfillments ?? []).some(
    (parcel) =>
      parcel?.shipped_at &&
      !parcel.canceled_at &&
      (parcel.items ?? []).some((item) => lineIds.has(item?.line_item_id ?? ""))
  )
}

/**
 * An exchange's new sale (the accountant, 2026-10-31,
 * docs/mali-musavir-sorulari.md 5.4: a return and a new sale), queued
 * once due:
 * - its goods came back (received; refunded too when the shop owed): the
 *   new items leave only then (adr/0032 §6);
 * - by the shop's setting: then (placed and paid, the default: what the
 *   shopper owed was collected at approval, the rest is what came back),
 *   or once the parcel with its new lines leaves.
 * Only where the order's first sale is invoiced here: a test-mode order,
 * or one sold before invoicing was on, has none, and its exchange none
 * either. Queuing twice is one invoice.
 */
export async function queueExchangeSale(
  container: Container,
  requestId: string
): Promise<QueueOutcome> {
  const settings = await invoicingOf(container)
  if (settings.provider === "none" || (settings.provider === "fake" && !fakeInvoicingAllowed())) {
    return "off"
  }
  const [request] = await requests(container).listReturnRequests({ id: requestId }, { take: 1 })
  if (
    request?.kind !== "exchange" ||
    !request.exchange_id ||
    !EXCHANGE_CAME_BACK.includes(request.status)
  ) {
    return "not_due"
  }
  const orderId = request.order_id
  const invoices = container.resolve<EinvoiceModuleService>(EINVOICE_MODULE)
  const [first] = await invoices.listInvoices(
    { order_id: orderId, kind: "sale", source_id: orderId },
    { select: ["status"], take: 1 }
  )
  if (!first || first.status === "cancelled") {
    return "not_due"
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: [
      "status",
      "canceled_at",
      "fulfillments.shipped_at",
      "fulfillments.canceled_at",
      "fulfillments.items.line_item_id",
    ],
    filters: { id: orderId },
  })
  const order = data[0] as ExchangeOrderRow | undefined
  const exchanges = await exchangesOf(container, orderId)
  const lines = exchangeLines({ exchanges }).get(request.exchange_id)
  if (!order || order.status === "canceled" || order.canceled_at || !lines?.length) {
    return "not_due"
  }
  const lineIds = new Set(lines.map((line) => line.line_item_id))
  if (settings.trigger === "shipped" && !parcelLeftWith(order, lineIds)) {
    return "not_due"
  }
  const amounts = await invoiceTotalsOf(container, orderId, { exchange_id: request.exchange_id })
  if (amounts?.currency.toLowerCase() !== "try" || Number(amounts.totals.gross) <= 0) {
    return "not_due"
  }
  const { id, created } = await invoices.enqueue({
    order_id: orderId,
    kind: "sale",
    source_id: requestId,
    provider: settings.provider,
    totals: amounts.totals,
  })
  if (created && settings.provider === "external") {
    await announceInvoice(container, id, orderId, amounts.totals.gross)
  }
  return created ? "queued" : "already"
}

/**
 * Every exchange of the order whose goods came back, its new sale queued
 * once due: a parcel left or arrived (the shop invoicing on shipping).
 * A failure is logged; the hourly sweep tries again.
 */
export async function queueOrderExchangeSales(container: Container, orderId: string) {
  const exchanges = await requests(container).listReturnRequests(
    { order_id: orderId, kind: "exchange", status: EXCHANGE_CAME_BACK },
    { select: ["id"], take: 50 }
  )
  let queued = 0
  for (const exchange of exchanges) {
    try {
      if ((await queueExchangeSale(container, exchange.id)) === "queued") {
        queued += 1
      }
    } catch (error) {
      logger.warn({ event: "einvoice.exchange_queue_failed", err: errorSummary(error) })
    }
  }
  return queued
}

/**
 * The sale a return gives back (the accountant, 2026-10-31): the order's
 * first sale, or the exchange's own when the lines came to the buyer
 * through an exchange. A return of lines from both is named by its first
 * line's sale. Null until that sale is issued.
 */
export async function saleReturned(
  container: Container,
  orderId: string,
  lineIds: readonly string[]
) {
  const exchanges = lineIds[0] ? await exchangesOf(container, orderId) : []
  const exchangeId = lineIds[0] ? exchangeOfLine({ exchanges }, lineIds[0]) : null
  let source = orderId
  if (exchangeId) {
    const [request] = await requests(container).listReturnRequests(
      { order_id: orderId, exchange_id: exchangeId },
      { select: ["id"], take: 1 }
    )
    if (!request) {
      return null
    }
    source = request.id
  }
  const [sale] = await container
    .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
    .listInvoices(
      { order_id: orderId, kind: "sale", source_id: source, status: "issued" },
      { take: 1 }
    )
  return sale ?? null
}
