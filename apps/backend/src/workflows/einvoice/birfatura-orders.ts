import type { MedusaContainer } from "@medusajs/framework/types"
import {
  MAX_ORDERS_PER_PULL,
  birfaturaOrder,
  birfaturaOrderId,
} from "../../lib/invoicing/birfatura"
import type { BirfaturaOrder } from "../../lib/invoicing/birfatura"
import { errorSummary, logger } from "../../lib/logging"
import { EINVOICE_MODULE } from "../../modules/einvoice"
import type EinvoiceModuleService from "../../modules/einvoice/service"
import type { PullableInvoice } from "../../modules/einvoice/service"
import { saleDraftSource } from "./draft-source"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The orders BirFatura pulls (adr/0072 §3.10, §5): the sale invoices
 * queued for it within the range, each as its `Orders[]` item. Personal
 * data: built when BirFatura asks and handed to the route only, never to
 * a workflow's record (adr/0034 §7). An order whose draft cannot be made
 * is left out, its reason kept on its record for staff; the rest go.
 */

export interface PulledOrders {
  orders: BirfaturaOrder[]
  /** What was handed out, for the audit entry: ids only. */
  listed: { invoice_id: string; order_id: string; birfatura_id: number }[]
  skipped: { invoice_id: string; code: string }[]
}

const serviceOf = (container: Container) =>
  container.resolve<EinvoiceModuleService>(EINVOICE_MODULE)

/** Which of the order's exchange invoices this is (1, 2, …); 0 for its first sale. */
async function exchangePlace(container: Container, invoice: PullableInvoice): Promise<number> {
  if (invoice.source_id === invoice.order_id) {
    return 0
  }
  const sales = await serviceOf(container).exchangeSales(invoice.order_id)
  return sales.findIndex((sale) => sale.id === invoice.id) + 1
}

async function orderOf(
  container: Container,
  invoice: PullableInvoice,
  now: Date
): Promise<{ order: BirfaturaOrder } | { code: string }> {
  const source = await saleDraftSource(
    container,
    { id: invoice.id, order_id: invoice.order_id, kind: "sale", source_id: invoice.source_id },
    now
  )
  if (!source) {
    return { code: "einvoice.no_lines" }
  }
  if ("problems" in source.result) {
    return { code: source.result.problems[0] ?? "einvoice.no_lines" }
  }
  const ids = birfaturaOrderId({
    display_id: source.display_id ?? 0,
    exchange: await exchangePlace(container, invoice),
  })
  if (!ids) {
    return { code: "einvoice.order_id_unavailable" }
  }
  const mapped = birfaturaOrder({
    draft: source.result.draft,
    items: source.items,
    shipping: source.shipping,
    order_id: ids.id,
    order_code: ids.code,
    ordered_at: source.placed_at,
  })
  return "problem" in mapped ? { code: mapped.problem } : { order: mapped.order }
}

/**
 * The pull narrowed to the invoices its stamp kept (`markListed`): an
 * invoice canceled between the list and the stamp is not handed out
 * (security review S-1). Its orders and its listed rows stay in step.
 */
export function keptOnly(pulled: PulledOrders, kept: readonly string[]): PulledOrders {
  const ids = new Set(kept)
  const listed = pulled.listed.filter((row) => ids.has(row.invoice_id))
  const handed = new Set(listed.map((row) => row.birfatura_id))
  return {
    orders: pulled.orders.filter((order) => handed.has(order.OrderId)),
    listed,
    skipped: pulled.skipped,
  }
}

/** How many pages of due invoices one pull reads at most. */
export const MAX_PAGES = 5

async function take(
  container: Container,
  invoice: PullableInvoice,
  now: Date,
  pulled: PulledOrders
): Promise<void> {
  let outcome: { order: BirfaturaOrder } | { code: string }
  try {
    outcome = await orderOf(container, invoice, now)
  } catch (error) {
    // One order that cannot be read never keeps the others from BirFatura
    logger.warn({
      event: "birfatura.order_failed",
      invoice_id: invoice.id,
      err: errorSummary(error),
    })
    outcome = { code: "einvoice.error" }
  }
  if ("code" in outcome) {
    pulled.skipped.push({ invoice_id: invoice.id, code: outcome.code })
    await serviceOf(container).noteProblem(invoice.id, outcome.code)
    return
  }
  pulled.orders.push(outcome.order)
  pulled.listed.push({
    invoice_id: invoice.id,
    order_id: invoice.order_id,
    birfatura_id: outcome.order.OrderId,
  })
}

export async function birfaturaOrders(
  container: Container,
  range: { start: Date; end: Date },
  now: Date = new Date()
): Promise<PulledOrders> {
  const service = serviceOf(container)
  const pulled: PulledOrders = { orders: [], listed: [], skipped: [] }
  // Orders that cannot be listed (a phone missing…) never hold back the ones behind them:
  // the pull reads on, a few pages at most, until it has a full answer
  for (let page = 0; page < MAX_PAGES && pulled.orders.length < MAX_ORDERS_PER_PULL; page++) {
    const due = await service.listBirfaturaDue(
      range,
      MAX_ORDERS_PER_PULL,
      page * MAX_ORDERS_PER_PULL
    )
    for (const invoice of due) {
      if (pulled.orders.length >= MAX_ORDERS_PER_PULL) {
        break
      }
      await take(container, invoice, now, pulled)
    }
    if (due.length < MAX_ORDERS_PER_PULL) {
      break
    }
  }
  return pulled
}
