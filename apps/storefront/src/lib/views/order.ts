import "server-only"
import { formatLira } from "@qticaret/ui"
import type { BankTransferView, OrderPageView, Translate } from "@qticaret/ui"
import type { PaymentMethods } from "@/lib/checkout/options"
import type { StoreOrder } from "@/lib/orders/order"
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

export function orderView(
  order: StoreOrder,
  methods: PaymentMethods | null,
  fresh: boolean,
  t: Translate
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
    })),
    items: formatLira(order.original_item_total),
    discount: discount > 0 ? formatLira(discount / 100) : null,
    shipping: order.shipping_total > 0 ? formatLira(order.shipping_total) : t("checkout.free"),
    total: formatLira(order.total),
    address: addressSummaryOf(order.email, order.shipping_address),
    documents: [],
    breadcrumbs: [
      { label: t("home.label"), path: "/" },
      { label: t("order.title", { id: order.display_id }), path: null },
    ],
  }
}
