import { CreditCard, PackageX } from "lucide-react"
import type { TFunction } from "i18next"

const text = (value: unknown): string => (typeof value === "string" ? value : "")

const ISSUES = [
  "completion_stuck",
  "refunded_before_order",
  "shelf_restored",
  // A second payment for a cart already ordered (finding 2026-11-16): never refunded on its own
  "payment_beside_order",
  // A wholesaler's cart its prices could not be set for (PR #100): the wholesale roles' alone
  "wholesale_price_check",
  // An order refund whose money left while its record could not be closed: `cart` is the order
  "refund_incomplete",
  // Such a refund the automatic check could not settle in an hour
  "refund_unresolved",
  // A cancel's refund closed by the automatic check, its order still open: cancel it, ship nothing
  "cancel_refund_order_open",
] as const

// An order refund's issue carries the order where a payment's carries its cart
const ORDER_ISSUES: ReadonlySet<Issue> = new Set([
  "refund_incomplete",
  "refund_unresolved",
  "cancel_refund_order_open",
])
type Issue = (typeof ISSUES)[number]

const isIssue = (value: unknown): value is Issue => ISSUES.includes(value as Issue)

const PROVIDERS: Readonly<Record<string, string>> = {
  paytr: "PayTR",
  iyzico: "iyzico",
  "bank-transfer": "Havale/EFT",
  cod: "Kapıda ödeme",
}

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
  const order = ORDER_ISSUES.has(issue) ? text(data["cart_id"]) : ""
  return {
    title: t(`notifications.paymentIssue.${issue}.title`, values),
    description: t(`notifications.paymentIssue.${issue}.description`, values),
    Icon: shelf ? PackageX : CreditCard,
    tone: shelf ? "bg-warning-soft text-warning-text" : "bg-destructive-soft text-destructive-text",
    link: shelf
      ? { to: "/inventory" as const, search: {}, params: {} }
      : issue === "wholesale_price_check"
        ? { to: "/wholesale" as const, search: {}, params: {} }
        : order
          ? { to: "/orders/$id" as const, search: {}, params: { id: order } }
          : { to: "/orders" as const, search: {}, params: {} },
  }
}
