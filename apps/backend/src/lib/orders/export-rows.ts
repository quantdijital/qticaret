import { MathBN } from "@medusajs/framework/utils"
import { lineAddonsOf } from "../catalog/addons"
import { lifecycleOf } from "../dashboard"
import type { Lifecycle, LifecycleOrder } from "../dashboard"
import { fromMedusaAmount } from "../money"
import type { MedusaAmount } from "../money"
import type { SheetCell } from "../sheets"
import { lineMetadataOf } from "./line-metadata"
import type { LineMetadataRow } from "./line-metadata"
import { paymentMethodOf } from "./payment-method"
import type { PaymentMethod, PaymentMethodOrder } from "./payment-method"

/**
 * The order list as a file (the owner's export): one row per order line,
 * the order's own columns repeated on each of its lines, so a sheet sums
 * and filters by product as well as by order; an order without lines is
 * one row with the line's columns empty. The order's amounts stand on each
 * of its rows, their headers saying "Sipariş …": summing them counts an
 * order once per line. Amounts are lira as numbers, times Turkey's.
 */

export interface ExportLine extends LineMetadataRow {
  product_title?: string | null
  title?: string | null
  variant_title?: string | null
  variant_sku?: string | null
  quantity?: MedusaAmount | null
  unit_price?: MedusaAmount | null
  total?: MedusaAmount | null
  metadata?: Record<string, unknown> | null
}

export type ExportOrderRow = LifecycleOrder & PaymentMethodOrder & ExportOrderFields

interface ExportOrderFields {
  id: string
  display_id: number | string
  created_at: string | Date
  email?: string | null
  customer?: { first_name?: string | null; last_name?: string | null; phone?: string | null } | null
  shipping_address?: {
    first_name?: string | null
    last_name?: string | null
    phone?: string | null
    city?: string | null
    province?: string | null
  } | null
  items?: (ExportLine | null)[] | null
  original_item_total?: MedusaAmount | null
  discount_total?: MedusaAmount | null
  original_shipping_total?: MedusaAmount | null
  tax_total?: MedusaAmount | null
  total?: MedusaAmount | null
}

/** What the order's other records add: its carrier, tracking number and invoice number. */
export interface ExportExtras {
  carrier: string | null
  tracking_number: string | null
  invoice_number: string | null
}

export const ORDER_EXPORT_HEADER: readonly string[] = [
  "Sipariş no",
  "Tarih",
  "Durum",
  "Müşteri",
  "E-posta",
  "Telefon",
  "İl",
  "İlçe",
  "Ürün",
  "Varyant",
  "SKU",
  "Adet",
  "Birim fiyat (TL)",
  "Satır toplamı (TL)",
  "Ek seçenekler",
  "Sipariş ara toplamı (TL)",
  "Sipariş indirimi (TL)",
  "Sipariş kargo ücreti (TL)",
  "Sipariş KDV (TL)",
  "Sipariş toplamı (TL)",
  "Ödeme yöntemi",
  "Kargo firması",
  "Takip no",
  "Fatura no",
]

export const ORDER_EXPORT_WIDTHS: readonly number[] = [
  11, 17, 14, 22, 28, 15, 14, 16, 32, 18, 16, 7, 14, 14, 36, 16, 14, 14, 14, 14, 16, 16, 18, 18,
]

const STAGES: Readonly<Record<Lifecycle, string>> = {
  awaiting_payment: "Ödeme bekliyor",
  to_ship: "Hazırlanacak",
  shipped: "Kargoda",
  delivered: "Teslim edildi",
  canceled: "İptal edildi",
}

const METHODS: Readonly<Record<PaymentMethod, string>> = {
  card: "Kart",
  bank_transfer: "Havale/EFT",
  cod: "Kapıda ödeme",
  payment_link: "Ödeme bağlantısı",
  gift_card: "Hediye kartı",
  other: "Diğer",
}

const TURKEY_OFFSET_MS = 3 * 60 * 60 * 1000

/** `2026-11-06 14:05`, as Turkey's clock reads it. */
export const turkishDateTime = (at: string | Date): string =>
  new Date(new Date(at).getTime() + TURKEY_OFFSET_MS).toISOString().slice(0, 16).replace("T", " ")

// Lira as a number a spreadsheet sums: 1234.5, never "₺1.234,50"
const lira = (amount: MedusaAmount | null | undefined): number | null =>
  amount === null || amount === undefined
    ? null
    : fromMedusaAmount(amount, { allowRounding: true }) / 100

const text = (value: string | null | undefined): string | null =>
  value && value.trim() !== "" ? value.trim() : null

/** A line's add-on picks in one cell: "Ürün üzerine yazı: Ahmet; Kılıf: Desenli Siyah". */
export const addonsCell = (metadata: unknown): string | null => {
  const items = lineAddonsOf(metadata)?.items ?? []
  return items.length > 0
    ? items
        .map(
          (item) =>
            `${item.label}: ${(item.kind === "choice" ? item.choice_label : item.value) ?? ""}`
        )
        .join("; ")
    : null
}

/** The order's rows, one per line. */
export function orderExportRows(order: ExportOrderRow, extras: ExportExtras): SheetCell[][] {
  const customer = order.customer
  const address = order.shipping_address
  const name =
    [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ||
    [address?.first_name, address?.last_name].filter(Boolean).join(" ") ||
    null
  const head: SheetCell[] = [
    Number(order.display_id),
    turkishDateTime(order.created_at),
    STAGES[lifecycleOf(order)],
    name,
    text(order.email),
    text(address?.phone) ?? text(customer?.phone),
    text(address?.province),
    text(address?.city),
  ]
  const tail: SheetCell[] = [
    lira(order.original_item_total),
    lira(order.discount_total),
    lira(order.original_shipping_total),
    lira(order.tax_total),
    lira(order.total),
    METHODS[paymentMethodOf(order)],
    extras.carrier,
    extras.tracking_number,
    extras.invoice_number,
  ]
  // The lifecycle's and the export's fields of the same lines
  const lines = ((order.items ?? []) as (ExportLine | null)[]).filter(
    (item): item is ExportLine => item !== null
  )
  if (lines.length === 0) {
    return [[...head, null, null, null, null, null, null, null, ...tail]]
  }
  return lines.map((item) => [
    ...head,
    text(item.product_title) ?? text(item.title),
    item.variant_title && item.variant_title !== "Default" ? item.variant_title : null,
    text(item.variant_sku),
    MathBN.convert(item.quantity ?? 0).toNumber(),
    lira(item.unit_price),
    lira(item.total),
    addonsCell(lineMetadataOf(item)),
    ...tail,
  ])
}
