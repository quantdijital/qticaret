import "server-only"
import { formatLira } from "@qticaret/ui"
import type { BankTransferView, ImageView, OrderPageView, Translate } from "@qticaret/ui"
import type { PaymentMethods } from "@/lib/checkout/options"
import type {
  InvoiceRow,
  ReturnRequestRow,
  ReturnableRow,
  ShipmentRow,
  StoreOrder,
} from "@/lib/orders/order"
import { providersOf } from "@/lib/orders/order"
import { lineAddonsOf } from "./addons"
import { addressSummaryOf } from "./checkout"
import { lineImageOf, linePathOf } from "./line-paths"
import { orderGiftOf } from "./order-gift"
import { orderProgress, paymentWordsOf } from "./order-progress"
import {
  DEFECT_REASONS,
  cancelOf,
  giftLinesOf,
  giftReasonsOf,
  refusedOf,
  requestWordsOf,
  returnReasonsOf,
  returnShippingNoteOf,
  returnableOf,
} from "./order-returns"

export { orderGiftOf } from "./order-gift"

const WHEN = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
})

const kurus = (lira: number) => Math.round(lira * 100)

/** A status in words; one without its own words shows as it is. */
function said(t: Translate, prefix: string, value: string): string {
  const key = `${prefix}${value}`
  const text = t(key)
  return text === key ? value : text
}

/** The IBAN in groups of four, as a bank prints it. */
const grouped = (iban: string) => iban.replace(/\s+/g, "").replace(/(.{4})(?=.)/g, "$1 ")

export interface OrderExtras {
  token: string | null
  /** The contracts kept for the order. */
  contracts: string[]
  returns: ReturnRequestRow[]
  /** What may still be asked back, as the backend counts it; null when it did not say. */
  returnable: ReturnableRow | null
  shipments: ShipmentRow[]
  invoice: InvoiceRow | null
  /** `?durum=` after an action. */
  note: string | null
  /** Opened by a shopper not signed in (adr/0046 Ek 2026-11-05): the page may offer an account. */
  guest?: boolean
  /** The lines' product pages (`productPathsOf`); none: the lines read as text. */
  paths?: ReadonlyMap<string, string>
  /** The lines' pictures with their versions (`linePicturesOf`); none: the thumbnails as they are. */
  pictures?: ReadonlyMap<string, ImageView>
}

const NOTES: Record<string, string> = {
  iptal: "order.notice_canceled",
  "iptal-olmadi": "order.notice_cancel_refused",
  // The backend's own refusals, in its words (`cancelOrder`)
  "iptal-hediye-karti": "orders.gift_card_used",
  "iptal-magaza": "orders.cancel_contact_shop",
}

// The carrier's words for where a parcel is; anything else reads as on its way
const PARCEL_STATES = new Set([
  "created",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "returned",
  "failed",
])

/** A parcel in words: its carrier's last status and when, or when it left. */
export function shipmentOf(parcel: ShipmentRow, t: Translate): OrderPageView["shipments"][number] {
  const state = parcel.delivered_at
    ? "delivered"
    : parcel.status && PARCEL_STATES.has(parcel.status)
      ? parcel.status
      : "in_transit"
  const at = parcel.delivered_at ?? parcel.status_at ?? parcel.shipped_at
  return {
    carrier: parcel.carrier,
    trackingNumber: parcel.tracking_number,
    trackingUrl: parcel.tracking_url,
    status: [t(`order.parcel_${state}`), at ? WHEN.format(new Date(at)) : null]
      .filter(Boolean)
      .join(" · "),
    items: parcel.items.map((item) => `${item.title} × ${String(item.quantity)}`).join(", "),
  }
}

/** A line's add-on picks and whether they take it outside the right of withdrawal (adr/0052 §8). */
const picksOf = (metadata: unknown) => {
  const { addons, nonWithdrawable } = lineAddonsOf(metadata)
  return { addons, nonWithdrawable }
}

/** An order page's own address, with its key when it was opened with one. */
export const orderHref = (id: string, token: string | null, rest = "") =>
  `/siparis/${encodeURIComponent(id)}${rest}${token ? `?token=${encodeURIComponent(token)}` : ""}`

export function orderView(
  order: StoreOrder,
  methods: PaymentMethods | null,
  fresh: boolean,
  t: Translate,
  extras: OrderExtras = {
    token: null,
    contracts: [],
    returns: [],
    returnable: null,
    shipments: [],
    invoice: null,
    note: null,
  }
): OrderPageView {
  const providers = providersOf(order)
  const transfer = methods?.bank_transfer ?? null
  const awaiting = order.payment_status === "not_paid" || order.payment_status === "awaiting"
  const bankTransfer: BankTransferView | null =
    transfer && providers.includes(transfer.provider_id) && awaiting
      ? {
          accountHolder: transfer.account_holder,
          bankName: transfer.bank_name,
          iban: grouped(transfer.iban),
          amount: formatLira(order.total),
          deadlineHours: transfer.deadline_hours,
        }
      : null
  const discount = kurus(order.original_item_total) - kurus(order.item_total)
  const gifts = giftLinesOf(order, extras.returnable)
  const titles = new Map(order.items.map((line) => [line.id, line.title]))
  return {
    displayId: String(order.display_id),
    placedAt: WHEN.format(new Date(order.created_at)),
    fresh,
    email: order.email,
    status: said(t, "order.status_", order.status),
    paymentStatus: said(t, "order.payment_", order.payment_status),
    bankTransfer,
    cashOnDelivery: providers.includes("pp_cod_cod"),
    lines: order.items.map((line) => ({
      title: line.title,
      detail: line.variant_title ?? line.subtitle,
      quantity: line.quantity,
      total: formatLira(line.total),
      image: lineImageOf(line.thumbnail, line.title, extras.pictures),
      path: extras.paths ? linePathOf(extras.paths, line) : null,
      gift: orderGiftOf(line.metadata),
      // The picks as sold: the line's own copy, whatever the product's add-ons are now
      ...picksOf(line.metadata),
    })),
    items: formatLira(order.original_item_total),
    discount: discount > 0 ? formatLira(discount / 100) : null,
    shipping: order.shipping_total > 0 ? formatLira(order.shipping_total) : t("checkout.free"),
    total: formatLira(order.total),
    address: addressSummaryOf(order.email, order.shipping_address),
    documents: [
      ...(extras.contracts.includes("pre_information")
        ? [
            {
              label: t("order.doc_pre_information"),
              path: orderHref(order.id, extras.token, "/belge/on-bilgilendirme"),
            },
          ]
        : []),
      ...(extras.contracts.includes("distance_sales")
        ? [
            {
              label: t("order.doc_distance_sales"),
              path: orderHref(order.id, extras.token, "/belge/mesafeli-satis"),
            },
          ]
        : []),
      ...(extras.invoice?.has_pdf
        ? [
            {
              label: t("order.doc_invoice", { number: extras.invoice.number ?? "" }),
              path: orderHref(order.id, extras.token, "/fatura"),
            },
          ]
        : []),
    ],
    token: extras.token,
    orderId: order.id,
    // The cancel's own rule, from the backend; the page's guess only when it did not say
    ...cancelOf(extras.returnable, order, t),
    cancelText: t(gifts.size > 0 ? "order.cancel_text_gift" : "order.cancel_text"),
    returnable: returnableOf(extras.returnable, order, t),
    returnReasons: returnReasonsOf(t),
    defectReasons: DEFECT_REASONS,
    giftReasons: giftReasonsOf(t),
    returnShippingNote: returnShippingNoteOf(t),
    returns: extras.returns.map((request) => ({
      ...requestWordsOf(request, gifts, t),
      date: WHEN.format(new Date(request.created_at)),
      refused: refusedOf(request, titles, t),
    })),
    shipments: extras.shipments.map((parcel) => shipmentOf(parcel, t)),
    notice: extras.note && NOTES[extras.note] ? t(NOTES[extras.note] ?? "") : null,
    progress: orderProgress(
      order,
      extras.shipments,
      { cashOnDelivery: providers.includes("pp_cod_cod") },
      t,
      (date) => WHEN.format(date)
    ),
    payment: paymentWordsOf(providers, t),
    guest: extras.guest ?? false,
    breadcrumbs: [
      { label: t("home.label"), path: "/" },
      { label: t("order.title", { id: order.display_id }), path: null },
    ],
  }
}
