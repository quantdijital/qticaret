import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { turkishDay } from "../../lib/dashboard/period"
import {
  SOLD_FIELDS,
  asSold,
  exchangeSaleOrder,
  firstSaleOrder,
  invoiceDraft,
  invoiceLines,
  invoiceTotals,
  returnedOrder,
} from "../../lib/invoicing"
import type { DraftResult, ExchangedOrder, ReturnedLine } from "../../lib/invoicing"
import { RETURN_REQUESTS_MODULE } from "../../modules/return-requests"
import type ReturnRequestsModuleService from "../../modules/return-requests/service"
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

/** What an invoice comes to, for its record when it is queued (no buyer read). */
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
  const order = partOf({ ...asSold(found), exchanges: await exchangesOf(container, orderId) }, part)
  return { currency: order.currency_code ?? "", totals: invoiceTotals(invoiceLines(order)) }
}

/**
 * The invoice an order asks for now (adr/0034 §3): its lines, its buyer,
 * how it was paid, and who carries it (`shipmentOf`). Personal data: read
 * when the program needs it, never handed to a workflow.
 */
export async function invoiceDraftFor(
  container: Container,
  invoice: {
    id: string
    order_id: string
    kind?: string
    source_id?: string
    original_invoice_id?: string | null
    document_type?: string | null
  },
  now: Date = new Date()
): Promise<DraftResult> {
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
      "customer.billing_profile.id",
      "customer.billing_profile.type",
      "customer.billing_profile.legal_name",
      "customer.billing_profile.tax_office",
    ],
    filters: { id: invoice.order_id },
  })
  const row = data[0] as OrderRow | undefined
  if (!row) {
    return { problems: ["einvoice.no_lines"] }
  }
  const order = { ...asSold(row), exchanges: await exchangesOf(container, invoice.order_id) }
  const settings = await settingsOf(container)
  const profile = await profileOf(container, order, invoice.id)
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
  const exchange =
    invoice.source_id && invoice.source_id !== invoice.order_id
      ? await exchangeOf(container, invoice.source_id)
      : null
  if (invoice.source_id && invoice.source_id !== invoice.order_id && !exchange) {
    return { problems: ["einvoice.no_lines"] }
  }
  const sold = partOf(order, exchange ? { exchange_id: exchange.exchange_id } : undefined)
  const lines = new Set((sold.items ?? []).flatMap((item) => (item?.id ? [item.id] : [])))
  const shipment = await shipmentOf(container, order, settings.carriers, now, lines)
  const result = invoiceDraft(sold, profile, { store_url: settings.store_url, shipment })
  // An exchange's new items were paid for by what came back (and what staff collected on approval)
  return exchange?.received_at && "draft" in result
    ? {
        draft: {
          ...result.draft,
          internet_sale: {
            ...result.draft.internet_sale,
            paid_on: turkishDay(new Date(exchange.received_at)),
          },
        },
      }
    : result
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
