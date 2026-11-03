import { CalendarClock } from "lucide-react"
import type { TFunction } from "i18next"
import { formatDate } from "@/lib/format"

const text = (value: unknown): string => (typeof value === "string" ? value : "")

/**
 * The bell's words for a return whose money is due soon (adr/0032 Ek
 * 2026-11-03, MSY md. 12/1): the server rings once on the 10th of the
 * law's 14 days, with the order's number and the last day (`due_at`). It
 * leads to the order, whose returns card receives and refunds it. Null
 * for any other alert.
 */
export function returnRefundAlert(t: TFunction, data: Record<string, unknown>) {
  if (data["kind"] !== "return_refund_deadline") {
    return null
  }
  const due = text(data["due_at"])
  const order = text(data["order_id"])
  return {
    title: t("notifications.returnRefundDeadline.title", {
      order: text(data["display_id"]) || "—",
      date: due && !Number.isNaN(Date.parse(due)) ? formatDate(due) : "—",
    }),
    description: t("notifications.returnRefundDeadline.description"),
    Icon: CalendarClock,
    tone: "bg-warning-soft text-warning-text",
    // Without the order (never sent so), the whole queue: it may be approved or received
    link: order
      ? { to: "/orders/$id" as const, search: {}, params: { id: order } }
      : { to: "/orders/returns" as const, search: { view: "all" }, params: {} },
  }
}
