import { formatCount, formatDate, formatMoney } from "@qticaret/admin-ui/lib/format"
import type { CustomerStats } from "@/features/customers/api/customers"

/** A customer's numbers (CU1, O4), each one a figure on a card or a list column. */
export type CustomerFigure = "orders" | "spent" | "average" | "lastOrder" | "city"

/** One figure's text: "—" for what is not known yet (no order, no city). */
export function figureText(stats: CustomerStats, figure: CustomerFigure, currency: string): string {
  switch (figure) {
    case "orders":
      return formatCount(stats.orders)
    case "spent":
      return formatMoney(stats.spent, currency)
    case "average":
      return stats.orders > 0 ? formatMoney(stats.average, currency) : "—"
    case "lastOrder":
      return stats.last_order_at ? formatDate(stats.last_order_at) : "—"
    case "city":
      return stats.city ?? "—"
  }
}
