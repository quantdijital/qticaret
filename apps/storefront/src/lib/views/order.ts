import "server-only"
import { formatLira } from "@qticaret/ui"
import type { BankTransferView, OrderGiftView, OrderPageView, Translate } from "@qticaret/ui"
import type { PaymentMethods } from "@/lib/checkout/options"
import type { InvoiceRow, ReturnRequestRow, ShipmentRow, StoreOrder } from "@/lib/orders/order"
import { providersOf } from "@/lib/orders/order"
import { addressSummaryOf } from "./checkout"

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
  shipments: ShipmentRow[]
  invoice: InvoiceRow | null
  /** `?durum=` after an action. */
  note: string | null
}

const REASONS = ["damaged", "wrong_item", "not_as_described", "changed_mind", "size_issue", "other"]
const SHIPPED = new Set(["shipped", "partially_shipped", "delivered", "partially_delivered"])
const NOTES: Record<string, string> = {
  iptal: "order.notice_canceled",
  "iptal-olmadi": "order.notice_cancel_refused",
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

const LAST4 = /^[0-9A-Za-z]{4}$/

/**
 * A gift card line's cards and recipient (adr/0025 Ek 2026-11-03): the
 * last four of each card issued (`qt_gift_cards`; never the code) and the
 * address in `qt_gift` (gone once erased). Null on any other line.
 */
export function orderGiftOf(metadata: unknown): OrderGiftView | null {
  if (typeof metadata !== "object" || metadata === null) {
    return null
  }
  const { qt_gift: gift, qt_gift_cards: cards } = metadata as Record<string, unknown>
  if (gift === undefined && cards === undefined) {
    return null
  }
  const email = (gift as { recipient_email?: unknown } | null)?.recipient_email
  return {
    cards: (Array.isArray(cards) ? cards : []).flatMap((card: unknown) => {
      const last4 = (card as { last4?: unknown } | null)?.last4
      return typeof last4 === "string" && LAST4.test(last4) ? [last4] : []
    }),
    recipient: typeof email === "string" && email.includes("@") ? email : null,
  }
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
      image: line.thumbnail
        ? {
            src: line.thumbnail,
            alt: line.title,
            width: null,
            height: null,
            sources: { avif: null, webp: null },
          }
        : null,
      gift: orderGiftOf(line.metadata),
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
    cancellable: order.status === "pending" && order.fulfillment_status === "not_fulfilled",
    returnable:
      order.status !== "canceled" && SHIPPED.has(order.fulfillment_status)
        ? order.items.map((line) => ({ id: line.id, title: line.title, quantity: line.quantity }))
        : null,
    returnReasons: REASONS.map((reason) => ({ value: reason, label: t(`order.reason_${reason}`) })),
    returns: extras.returns.map((request) => ({
      kind: said(t, "order.return_kind_", request.kind),
      status: said(t, "order.return_status_", request.status),
      date: WHEN.format(new Date(request.created_at)),
      code: request.return_code,
    })),
    shipments: extras.shipments.map((parcel) => shipmentOf(parcel, t)),
    notice: extras.note && NOTES[extras.note] ? t(NOTES[extras.note] ?? "") : null,
    breadcrumbs: [
      { label: t("home.label"), path: "/" },
      { label: t("order.title", { id: order.display_id }), path: null },
    ],
  }
}
