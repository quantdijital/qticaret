import { CreditCard, PackageX } from "lucide-react"
import type { TFunction } from "i18next"

const text = (value: unknown): string => (typeof value === "string" ? value : "")

const ISSUES = [
  "completion_stuck",
  "refunded_before_order",
  "shelf_restored",
  // A wholesaler's cart its prices could not be set for (PR #100): the wholesale roles' alone
  "wholesale_price_check",
] as const
type Issue = (typeof ISSUES)[number]

const isIssue = (value: unknown): value is Issue => ISSUES.includes(value as Issue)

const PROVIDERS: Readonly<Record<string, string>> = { paytr: "PayTR", iyzico: "iyzico" }

const money = (value: unknown) =>
  typeof value === "number"
    ? new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(value / 100)
    : "—"

/**
 * The bell's words for a paid cart's trouble (adr/0026 Ek 2026-11-06): an
 * order that keeps failing to open, a payment refunded by hand before its
 * order, stock raised for an order and lowered back. Null for any other alert.
 */
export function paymentIssueAlert(t: TFunction, data: Record<string, unknown>) {
  if (data["kind"] !== "payment_issue" || !isIssue(data["issue"])) {
    return null
  }
  const issue = data["issue"]
  const values = {
    provider: PROVIDERS[text(data["provider"])] ?? text(data["provider"]),
    reference: text(data["reference"]) || "—",
    cart: text(data["cart_id"]) || "—",
    amount: money(data["amount"]),
  }
  const shelf = issue === "shelf_restored"
  return {
    title: t(`notifications.paymentIssue.${issue}.title`, values),
    description: t(`notifications.paymentIssue.${issue}.description`, values),
    Icon: shelf ? PackageX : CreditCard,
    tone: shelf ? "bg-warning-soft text-warning-text" : "bg-destructive-soft text-destructive-text",
    link: shelf
      ? { to: "/inventory" as const, search: {}, params: {} }
      : issue === "wholesale_price_check"
        ? { to: "/customers/wholesale" as const, search: {}, params: {} }
        : { to: "/orders" as const, search: {}, params: {} },
  }
}
