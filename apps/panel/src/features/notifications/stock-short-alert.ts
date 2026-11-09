import { PackageX } from "lucide-react"
import type { TFunction } from "i18next"

const text = (value: unknown): string => (typeof value === "string" ? value : "")

/** "Chuby / Kahverengi ×1": the alert's lines as the server sent them. */
function linesOf(value: unknown): string {
  if (!Array.isArray(value)) {
    return ""
  }
  return value
    .flatMap((line: unknown) => {
      const { title, short } = (line ?? {}) as { title?: unknown; short?: unknown }
      return typeof title === "string" && typeof short === "number"
        ? [`${title} ×${String(short)}`]
        : []
    })
    .join(", ")
}

/**
 * The bell's words for a paid order placed short of stock (adr/0026 Ek
 * 2026-11-06): its number and the lines the shelf lacked. It leads to the
 * order, where the shop cancels and refunds if it cannot make the units
 * good. Null for any other alert.
 */
export function stockShortAlert(t: TFunction, data: Record<string, unknown>) {
  if (data["kind"] !== "stock_short") {
    return null
  }
  const order = text(data["order_id"])
  return {
    title: t("notifications.stockShort.title", { number: text(data["number"]) || "—" }),
    description: t("notifications.stockShort.description", {
      lines: linesOf(data["lines"]) || "—",
    }),
    Icon: PackageX,
    tone: "bg-destructive-soft text-destructive-text",
    link: order
      ? { to: "/orders/$id" as const, search: {}, params: { id: order } }
      : { to: "/orders" as const, search: {}, params: {} },
  }
}
