import { CircleCheck, PackageX, TriangleAlert } from "lucide-react"
import type { TFunction } from "i18next"

const text = (value: unknown): string => (typeof value === "string" ? value : "")

/**
 * The bell's words for a payment link (adr/0051): paid (to its order),
 * its prices moved or a line ran out (to the link, to make it again).
 * Null for any other alert.
 */
export function paymentLinkAlert(t: TFunction, data: Record<string, unknown>) {
  const kind = data["kind"]
  if (
    kind !== "payment_link_paid" &&
    kind !== "payment_link_prices_changed" &&
    kind !== "payment_link_out_of_stock"
  ) {
    return null
  }
  const number = text(data["number"])
  const linkPage = {
    to: "/payment-links/$id" as const,
    search: {},
    params: { id: text(data["payment_link_id"]) },
  }
  if (kind === "payment_link_paid") {
    const order = text(data["order_id"])
    return {
      title: t("notifications.paymentLinkPaid.title", { number }),
      description: t("notifications.paymentLinkPaid.description"),
      Icon: CircleCheck,
      tone: "bg-success-soft text-success-text",
      link: order ? { to: "/orders/$id" as const, search: {}, params: { id: order } } : linkPage,
    }
  }
  const prices = kind === "payment_link_prices_changed"
  return {
    title: t(
      prices ? "notifications.paymentLinkPrices.title" : "notifications.paymentLinkStock.title",
      { number }
    ),
    description: t(
      prices
        ? "notifications.paymentLinkPrices.description"
        : "notifications.paymentLinkStock.description"
    ),
    Icon: prices ? TriangleAlert : PackageX,
    tone: "bg-warning-soft text-warning-text",
    link: linkPage,
  }
}
