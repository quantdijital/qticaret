import { Store } from "lucide-react"
import type { TFunction } from "i18next"

const text = (value: unknown): string => (typeof value === "string" ? value : "")

/**
 * The bell's words for a wholesaler's order (ADR-0068): the company that
 * placed it (named by the server as the order lists name it), its number
 * and total. It leads to Toptancılar > Siparişler, searched for its
 * number. Only roles that see wholesalers get it. Null for any other alert.
 */
export function wholesaleOrderAlert(t: TFunction, data: Record<string, unknown>) {
  if (data["kind"] !== "wholesale_order") {
    return null
  }
  const number = text(data["number"])
  const company = text(data["company"]) || t("wholesale.orders.unnamed")
  return {
    title: t("notifications.wholesaleOrder.title", { number: number || "—" }),
    description: [company, text(data["total"])].filter(Boolean).join(" · "),
    Icon: Store,
    tone: "bg-info-soft text-info-text",
    link: {
      to: "/customers/wholesale/orders" as const,
      search: number ? { q: number, stage: "all" } : {},
      params: {},
    },
  }
}
