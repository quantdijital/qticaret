import { messageText } from "../texts"
import { renderEmail } from "./layout"
import type { MessageTemplate } from "./types"

/**
 * A paid cart's trouble, to the staff list beside the bell (adr/0026 Ek
 * 2026-11-06): an order that keeps failing to open, a payment refunded
 * before its order, a stock raise lowered back after a crash.
 */
export interface StaffPaymentIssueVars {
  issue: "completion_stuck" | "refunded_before_order" | "shelf_restored" | "wholesale_price_check"
  provider: string
  reference: string
  cart: string
  amount: string
}

export const PAYMENT_ISSUES: readonly StaffPaymentIssueVars["issue"][] = [
  "completion_stuck",
  "refunded_before_order",
  "shelf_restored",
  "wholesale_price_check",
]

export const staffPaymentIssue: MessageTemplate<StaffPaymentIssueVars> = {
  name: "staff.payment_issue",
  kind: "transactional",
  channels: ["email"],
  retry: true,
  email: (vars, brand) =>
    renderEmail(brand, {
      subject: messageText(`staff_payment_issue.${vars.issue}.subject`, { ...vars }),
      preheader: messageText("staff_payment_issue.preheader", { ...vars }),
      heading: messageText("staff_payment_issue.heading"),
      blocks: [
        {
          kind: "paragraph",
          text: messageText(`staff_payment_issue.${vars.issue}.intro`, { ...vars }),
        },
        {
          kind: "summary",
          rows: [
            { label: messageText("staff_payment_issue.provider"), value: vars.provider },
            { label: messageText("staff_payment_issue.reference"), value: vars.reference },
            { label: messageText("staff_payment_issue.cart"), value: vars.cart },
            { label: messageText("staff_payment_issue.amount"), value: vars.amount, strong: true },
          ],
        },
      ],
      footer: messageText("footer.staff", { shop: brand.shopName }),
    }),
  sample: {
    issue: "completion_stuck",
    provider: "PayTR",
    reference: "payses01ORNEK",
    cart: "cart_01ORNEK",
    amount: "389,80 TRY",
  },
}
