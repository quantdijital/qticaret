import { CircleCheck, PackageX, ShieldAlert, TriangleAlert } from "lucide-react"
import type { TFunction } from "i18next"

const text = (value: unknown): string => (typeof value === "string" ? value : "")

/**
 * The bell's words for a payment link (adr/0051): paid (to its order), an
 * order from it to check for a second charge (to that order), its prices
 * moved or a line ran out (to the link, to make it again). Null for any
 * other alert.
 */
export function paymentLinkAlert(t: TFunction, data: Record<string, unknown>) {
  const kind = data["kind"]
  if (
    kind !== "payment_link_paid" &&
    kind !== "payment_link_needs_review" &&
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
  const order = text(data["order_id"])
  const orderPage = order
    ? { to: "/orders/$id" as const, search: {}, params: { id: order } }
    : linkPage
  if (kind === "payment_link_paid") {
    return {
      title: t("notifications.paymentLinkPaid.title", { number }),
      description: t("notifications.paymentLinkPaid.description"),
      Icon: CircleCheck,
      tone: "bg-success-soft text-success-text",
      link: orderPage,
    }
  }
  if (kind === "payment_link_needs_review") {
    return {
      title: t("notifications.paymentLinkReview.title", { number }),
      description: t("notifications.paymentLinkReview.description"),
      Icon: ShieldAlert,
      tone: "bg-destructive-soft text-destructive-text",
      link: orderPage,
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
