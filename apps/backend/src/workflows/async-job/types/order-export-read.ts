import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { LIFECYCLE_FIELDS, lifecycleOf } from "../../../lib/dashboard"
import { orderExportRows } from "../../../lib/orders/export-rows"
import type { ExportOrderRow } from "../../../lib/orders/export-rows"
import { PAYMENT_METHOD_FIELDS } from "../../../lib/orders/payment-method"
import { carrierNameOf } from "../../../lib/shipping/carriers"
import type { SheetCell } from "../../../lib/sheets"
import { deliveriesOf, shippingOf } from "../../../api/admin/order-board/parcels"
import type { DeliveryOrder } from "../../../api/admin/order-board/parcels"
import { boardRows } from "../../../api/admin/order-board/rows"
import type { OrderFilters } from "../../../api/admin/order-board/validators"
import { EINVOICE_MODULE } from "../../../modules/einvoice"
import type EinvoiceModuleService from "../../../modules/einvoice/service"

// Orders read in full at a time: a few hundred lines' worth, never the whole list at once
export const EXPORT_BATCH = 100

const ORDER_FIELDS = [
  "id",
  "display_id",
  "created_at",
  "email",
  ...LIFECYCLE_FIELDS,
  ...PAYMENT_METHOD_FIELDS,
  "original_item_total",
  "discount_total",
  "original_shipping_total",
  "tax_total",
  "total",
  "customer.first_name",
  "customer.last_name",
  "customer.phone",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.phone",
  "shipping_address.city",
  "shipping_address.province",
  "items.product_title",
  "items.title",
  "items.variant_title",
  "items.variant_sku",
  "items.unit_price",
  "items.total",
  "items.metadata",
  "items.line_item_metadata",
  "shipping_methods.name",
  "shipping_methods.shipping_option_id",
  "fulfillments.provider_id",
  "fulfillments.data",
  "fulfillments.metadata",
  "fulfillments.canceled_at",
  "fulfillments.created_at",
  "fulfillments.labels.tracking_number",
]

type Fulfillment = {
  provider_id?: string | null
  data?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  canceled_at?: string | Date | null
  created_at?: string | Date | null
  labels?: ({ tracking_number?: string | null } | null)[] | null
} | null

type FullRow = ExportOrderRow & DeliveryOrder & { fulfillments?: Fulfillment[] | null }

const CARRIER_TITLES = {
  aras: "Aras Kargo",
  yurtici: "Yurtiçi Kargo",
  dhlecommerce: "DHL eCommerce",
  surat: "Sürat Kargo",
  ptt: "PTT Kargo",
} as const

/** The order's latest standing parcel: who carries it and its label's number. */
function parcelOf(order: FullRow) {
  const standing = (order.fulfillments ?? [])
    .filter((row): row is NonNullable<Fulfillment> => row !== null && !row.canceled_at)
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
  const latest = standing[0]
  return {
    carrier: latest ? carrierNameOf(latest.provider_id, latest.metadata) : null,
    tracking: latest?.labels?.find((label) => label?.tracking_number)?.tracking_number ?? null,
  }
}

/** The orders' sale invoices' numbers, the order's own sale first. */
async function invoiceNumbersOf(container: MedusaContainer, orderIds: string[]) {
  const rows = await container
    .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
    .listInvoices(
      { order_id: orderIds, kind: "sale" },
      { select: ["order_id", "source_id", "number"], order: { created_at: "ASC" } }
    )
  const numbers = new Map<string, string>()
  for (const row of rows) {
    if (row.number && (row.source_id === row.order_id || !numbers.has(row.order_id))) {
      numbers.set(row.order_id, row.number)
    }
  }
  return numbers
}

/** The ids the filters leave, newest first, in the asked tab. */
export async function exportedIds(
  container: MedusaContainer,
  filters: OrderFilters
): Promise<{ ids: string[]; limited: boolean }> {
  const { rows, limited } = await boardRows(container, filters)
  return {
    ids: rows
      .filter((row) => filters.stage === "all" || lifecycleOf(row) === filters.stage)
      .map((row) => row.id),
    limited,
  }
}

/** One batch of orders as the file's rows, in the order of `ids`. */
export async function exportBatch(
  container: MedusaContainer,
  ids: string[]
): Promise<SheetCell[][]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ORDER_FIELDS,
    filters: { id: ids },
  })
  const rows = data as unknown as FullRow[]
  const [deliveries, parcels, invoices] = await Promise.all([
    deliveriesOf(container, rows),
    shippingOf(container, ids),
    invoiceNumbersOf(container, ids),
  ])
  const byId = new Map(rows.map((row) => [row.id, row]))
  return ids.flatMap((id) => {
    const order = byId.get(id)
    if (!order) {
      return []
    }
    const parcel = parcelOf(order)
    const delivery = deliveries.get(id)
    return orderExportRows(order, {
      carrier:
        parcel.carrier ??
        (delivery?.carrier ? CARRIER_TITLES[delivery.carrier] : (delivery?.name ?? null)),
      tracking_number: parcels.get(id)?.tracking_number ?? parcel.tracking,
      invoice_number: invoices.get(id) ?? null,
    })
  })
}
