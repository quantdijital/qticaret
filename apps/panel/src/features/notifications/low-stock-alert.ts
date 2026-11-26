import { PackageMinus } from "lucide-react"
import type { TFunction } from "i18next"

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "")
const amount = (value: unknown): number => (typeof value === "number" ? value : 0)

// A record's id ("iitem_01M7…"): never shown to the shop
const RECORD_ID = /^[a-z]+_[0-9A-Z]{20,}$/

/**
 * The bell's words for a product running low (F3.8, adr/0020): the server
 * names it by product and variant ("Sürmene Şef Bıçağı — Kahve") and opens
 * its product. An alert stored before that carries no name, or the item's
 * id: it reads "a product" and opens the low-stock list. Null for any
 * other alert.
 */
export function lowStockAlert(t: TFunction, data: Record<string, unknown>) {
  if (data["kind"] !== "low_stock") {
    return null
  }
  const stored = text(data["name"])
  const name = stored && !RECORD_ID.test(stored) ? stored : t("notifications.lowStock.unnamed")
  const product = text(data["product_id"])
  return {
    title: t("notifications.lowStock.title", { name }),
    description: t("notifications.lowStock.description", {
      count: amount(data["available"]),
      threshold: amount(data["threshold"]),
    }),
    Icon: PackageMinus,
    tone: "bg-warning-soft text-warning-text",
    link: product
      ? { to: "/products/$id" as const, search: {}, params: { id: product } }
      : { to: "/inventory" as const, search: { view: "low" }, params: {} },
  }
}
