import type { MedusaContainer } from "@medusajs/framework/types"
import type { StaffPaymentIssueVars } from "../../../lib/messaging/templates"
import { PAYMENT_ISSUES } from "../../../lib/messaging/templates/staff-payment-issue"
import type { Loaded } from "./types"

const isIssue = (value: string | undefined): value is StaffPaymentIssueVars["issue"] =>
  PAYMENT_ISSUES.includes(value as StaffPaymentIssueVars["issue"])

/** A payment's trouble as its alert saw it (its words come with the send, as the stock alert's). */
export function loadStaffPaymentIssue(
  _container: Pick<MedusaContainer, "resolve">,
  _resourceId: string,
  extra: Readonly<Record<string, string>>
): Promise<Loaded<StaffPaymentIssueVars> | null> {
  const issue = extra["issue"]
  return Promise.resolve(
    isIssue(issue) && extra["reference"]
      ? {
          vars: {
            issue,
            provider: extra["provider"] ?? "—",
            reference: extra["reference"],
            cart: extra["cart"] ?? "—",
            amount: extra["amount"] ?? "—",
          },
          recipients: {},
          receiverId: null,
          resourceType: "payment",
        }
      : null
  )
}
