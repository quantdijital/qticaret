import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { turkishDay } from "../../lib/dashboard/period"
import {
  SOLD_FIELDS,
  asSold,
  exchangeSaleOrder,
  firstSaleOrder,
  invoiceDraft,
  invoiceItemRefs,
  invoiceLines,
  invoiceTotals,
  returnedOrder,
  splitAdvance,
} from "../../lib/invoicing"
import type { DraftResult, ExchangedOrder, ReturnedLine } from "../../lib/invoicing"
import { RETURN_REQUESTS_MODULE } from "../../modules/return-requests"
import type ReturnRequestsModuleService from "../../modules/return-requests/service"
import { giftLineIdsOf } from "../gift-cards/gift-marks"
import { exchangesOf, profileOf, settingsOf, shipmentOf } from "./draft-parts"
import type { OrderRow } from "./draft-parts"
import { returnDraft } from "./return-source"

type Container = Pick<MedusaContainer, "resolve">

const TOTALS = ["subtotal", "discount_subtotal", "tax_total", "total", "tax_lines.rate"]
const ADDRESS = [
  "first_name",
  "last_name",
  "company",
  "address_1",
  "address_2",
  "city",
  "province",
  "postal_code",
  "phone",
]

/** The order's lines as the invoice reads them: no buyer in them. */
const LINE_FIELDS = [
  "id",
  "currency_code",
  // Medusa totals the lines only when the order's own total is asked for
  "total",
  ...[
    "id",
    "title",
    "product_title",
    "variant_title",
    "variant_id",
    // A program that names products by code (BirFatura, adr/0072 §5)
    "variant_sku",
    // A gift card line's product: its money is an advance, not the invoice's
    "product_id",
    "is_custom_price",
    "metadata",
    "quantity",
    ...TOTALS,
  ].map((field) => `items.${field}`),
  ...["name", ...TOTALS].map((field) => `shipping_methods.${field}`),
  // The lines as sold: Medusa's totals shrink as units come back
  ...SOLD_FIELDS,
]

const query = (container: Container) => container.resolve(ContainerRegistrationKeys.QUERY)

/**
 * Which part of the order an invoice is for: its first sale (none given),
 * an exchange's new sale, or what a return brought back.
 */
export type OrderPart =
  { exchange_id: string } | { lines: readonly ReturnedLine[]; shipping: boolean }

function partOf<T extends ExchangedOrder>(order: T, part?: OrderPart): T {
  if (!part) {
    return firstSaleOrder(order)
  }
  return "exchange_id" in part
    ? exchangeSaleOrder(order, part.exchange_id)
    : returnedOrder(order, part.lines, part.shipping)
}

/** The order's gift card lines (`giftLineIdsOf`): an advance, never on an invoice. */
const giftLinesIn = (container: Container, order: ExchangedOrder) =>
  giftLineIdsOf(
    container,
    (order.items ?? []) as ({ id: string; product_id?: string | null; metadata?: unknown } | null)[]
  )

/**
 * What an invoice comes to, for its record when it is queued (no buyer
 * read): its lines without the gift card lines, how many there are, and
 * what those came to (the advance, docs/mali-musavir-sorulari.md 3.2).
 */
export async function invoiceTotalsOf(container: Container, orderId: string, part?: OrderPart) {
  const { data } = await query(container).graph({
    entity: "order",
    fields: LINE_FIELDS,
    filters: { id: orderId },
  })
  const found = data[0] as ExchangedOrder | undefined
  if (!found) {
    return null
  }
  const sold = partOf({ ...asSold(found), exchanges: await exchangesOf(container, orderId) }, part)
  const { order, advance } = splitAdvance(sold, await giftLinesIn(container, found))
  const lines = invoiceLines(order)
  return {
    currency: order.currency_code ?? "",
    totals: invoiceTotals(lines),
    lines: lines.length,
    advance,
  }
}

/**
 * The invoice an order asks for now (adr/0034 §3): its lines, its buyer,
 * how it was paid, and who carries it (`shipmentOf`). Personal data: read
 * when the program needs it, never handed to a workflow.
 */
export async function invoiceDraftFor(
  container: Container,
  invoice: DraftedInvoice,
  now: Date = new Date()
): Promise<DraftResult> {
  const read = await orderForDraft(container, invoice)
  if (!read) {
    return { problems: ["einvoice.no_lines"] }
  }
  const { order, settings, profile } = read
  if (invoice.kind === "return") {
    const result = await returnDraft(
      container,
      order,
      {
        source_id: invoice.source_id ?? "",
        original_invoice_id: invoice.original_invoice_id ?? null,
        document_type: invoice.document_type ?? null,
      },
      { store_url: settings.store_url, profile }
    )
    return result ?? { problems: ["einvoice.no_lines"] }
  }
  return (await saleDraft(container, invoice, read, now)).result
}

/**
 * A sale invoice's draft with what a program naming products by code and
 * delivering to an address of its own needs besides (BirFatura, adr/0072
 * §5): each item line's order line, variant and SKU, the delivery address,
 * the order's number and when it was placed. Personal data, as the draft.
 */
export async function saleDraftSource(
  container: Container,
  invoice: DraftedInvoice,
  now: Date = new Date()
) {
  const read = await orderForDraft(container, invoice)
  if (!read) {
    return null
  }
  const { result, sold } = await saleDraft(container, invoice, read, now)
  const to = read.row.shipping_address
  const name = [to?.first_name, to?.last_name].filter(Boolean).join(" ")
  return {
    result,
    items: invoiceItemRefs(sold),
    shipping: to
      ? {
          name: name || null,
          address: [to.address_1, to.address_2].filter(Boolean).join(" ") || null,
          district: to.city ?? null,
          city: to.province ?? null,
          postal_code: to.postal_code ?? null,
          phone: to.phone ?? null,
        }
      : null,
    display_id: read.row.display_id ?? null,
    placed_at: new Date(read.row.created_at),
  }
}

interface DraftedInvoice {
  id: string
  order_id: string
  kind?: string
  source_id?: string
  original_invoice_id?: string | null
  document_type?: string | null
}

type DraftRead = NonNullable<Awaited<ReturnType<typeof orderForDraft>>>

/** The order as a draft reads it, its gift card lines taken off, with the settings and the buyer's profile. */
async function orderForDraft(container: Container, invoice: DraftedInvoice) {
  const { data } = await query(container).graph({
    entity: "order",
    fields: [
      ...LINE_FIELDS,
      "display_id",
      "created_at",
      "email",
      "customer_id",
      ...ADDRESS.map((field) => `billing_address.${field}`),
      ...ADDRESS.map((field) => `shipping_address.${field}`),
      "payment_collections.payments.provider_id",
      "payment_collections.payments.amount",
      "payment_collections.payments.captured_at",
      "payment_collections.payments.created_at",
      "fulfillments.provider_id",
      "fulfillments.shipped_at",
      "fulfillments.canceled_at",
      "fulfillments.items.line_item_id",
      "shipping_methods.shipping_option_id",
      // A gift card that paid for it: the invoice says so (docs/mali-musavir-sorulari.md 3.2)
      "credit_lines.reference",
      "credit_lines.raw_amount",
      "credit_lines.version",
      "customer.billing_profile.id",
      "customer.billing_profile.type",
      "customer.billing_profile.legal_name",
      "customer.billing_profile.tax_office",
    ],
    filters: { id: invoice.order_id },
  })
  const row = data[0] as OrderRow | undefined
  if (!row) {
    return null
  }
  // Its gift card lines are an advance: on no invoice, nor on a return's document
  const { order } = splitAdvance(
    { ...asSold(row), exchanges: await exchangesOf(container, invoice.order_id) },
    await giftLinesIn(container, row)
  )
  const settings = await settingsOf(container)
  const profile = await profileOf(container, order, invoice.id)
  return { row, order, settings, profile }
}

/** A sale's draft: the first sale's, or an exchange's new sale; and the lines it was made of. */
async function saleDraft(
  container: Container,
  invoice: DraftedInvoice,
  { order, settings, profile }: DraftRead,
  now: Date
): Promise<{ result: DraftResult; sold: ExchangedOrder }> {
  const exchange =
    invoice.source_id && invoice.source_id !== invoice.order_id
      ? await exchangeOf(container, invoice.source_id)
      : null
  if (invoice.source_id && invoice.source_id !== invoice.order_id && !exchange) {
    return { result: { problems: ["einvoice.no_lines"] }, sold: { ...order, items: [] } }
  }
  const sold = partOf(order, exchange ? { exchange_id: exchange.exchange_id } : undefined)
  const lines = new Set((sold.items ?? []).flatMap((item) => (item?.id ? [item.id] : [])))
  const shipment = await shipmentOf(container, order, settings.carriers, now, lines)
  const result = invoiceDraft(sold, profile, { store_url: settings.store_url, shipment })
  // An exchange's new items were paid for by what came back (and what staff collected on approval)
  if (exchange?.received_at && "draft" in result) {
    const paidOn = turkishDay(new Date(exchange.received_at))
    return {
      result: {
        draft: {
          ...result.draft,
          internet_sale: { ...result.draft.internet_sale, paid_on: paidOn },
        },
      },
      sold,
    }
  }
  return { result, sold }
}

/** The exchange a request opened, once its goods came back; null for any other. */
async function exchangeOf(container: Container, requestId: string) {
  const [request] = await container
    .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
    .listReturnRequests(
      { id: requestId, kind: "exchange" },
      { select: ["exchange_id", "received_at"], take: 1 }
    )
  return request?.exchange_id
    ? { exchange_id: request.exchange_id, received_at: request.received_at }
    : null
}
