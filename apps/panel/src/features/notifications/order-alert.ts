import { Landmark, ShoppingBag, Store } from "lucide-react"
import type { TFunction } from "i18next"

const text = (value: unknown): string => (typeof value === "string" ? value : "")

/**
 * The bell's words for a placed order: each order rings once (the owner,
 * 2026-11-16: "her yeni sipariş zile düşsün"), worded from its data, no
 * one's name in it but a wholesaler's company on the page. Null for any
 * other alert.
 * - A wholesaler's (ADR-0068): its number and total, the company on the
 *   page (the bell has none), whether a transfer is awaited; it leads to
 *   Toptancılar > Siparişler searched for its number. Only roles that see
 *   wholesalers get it.
 * - A retail one: "new order", or "transfer awaited"; it leads to the order.
 */
export function orderAlert(t: TFunction, data: Record<string, unknown>) {
  const number = text(data["number"])
  const total = text(data["total"])
  const order = text(data["order_id"])
  if (data["kind"] === "wholesale_order") {
    return {
      title: t("notifications.wholesaleOrder.title", { number: number || "—" }),
      description: [
        text(data["company"]),
        total,
        data["bank_transfer"] === true ? t("notifications.wholesaleOrder.transfer") : "",
      ]
        .filter(Boolean)
        .join(" · "),
      Icon: Store,
      tone: "bg-info-soft text-info-text",
      link: {
        to: "/wholesale/orders" as const,
        search: number ? { q: number, stage: "all" } : {},
        params: {},
      },
    }
  }
  if (data["kind"] !== "new_order" && data["kind"] !== "bank_transfer_pending") {
    return null
  }
  const transfer = data["kind"] === "bank_transfer_pending"
  const words = transfer ? "bankTransfer" : "newOrder"
  return {
    title: t(`notifications.${words}.title`, { number: number || "—" }),
    description: t(`notifications.${words}.description`, { total }),
    Icon: transfer ? Landmark : ShoppingBag,
    tone: transfer ? "bg-warning-soft text-warning-text" : "bg-info-soft text-info-text",
    link: order
      ? { to: "/orders/$id" as const, search: {}, params: { id: order } }
      : { to: "/orders" as const, search: {}, params: {} },
  }
}
