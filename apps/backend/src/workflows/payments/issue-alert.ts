import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { notificationText } from "../../lib/notifications/messages"
import { alertStaff } from "../messaging/staff"

/**
 * A paid cart's trouble the shop must see (adr/0026 Ek 2026-11-06,
 * security review 2026-11-09):
 * - `completion_stuck`: the order keeps failing to open (the shelf
 *   refused it again, or the provider has sent it many times); it is
 *   still tried, never refunded on its own;
 * - `refunded_before_order`: the provider shows the payment refunded (by
 *   hand, in its panel): no order is opened for it;
 * - `shelf_restored`: a stock level raised for a paid order was left so
 *   (a crash) and has been lowered back;
 * - `wholesale_price_check`: a wholesale cart the payment start could not
 *   set at its customer's prices (ADR-0068 slice 4 review N3): no payment
 *   was started; the reference is the cart, so once per cart;
 * - `payment_beside_order`: a payment for a cart already an order through
 *   another payment (finding 2026-11-16, review N2): not given back on its
 *   own; the shop checks whether the shopper paid twice;
 * - `refund_incomplete`: an order refund whose money left, or may have,
 *   while a step after failed (review 2026-11-17): its record is kept
 *   pending, never given back again on its own, and checked by the
 *   settling job; at a provider with a panel only. The reference is the
 *   refund's, `cart_id` carries the order;
 * - `refund_unresolved`: such a refund still open an hour on: the shop
 *   checks it by hand.
 */
export type PaymentIssue =
  | "completion_stuck"
  | "refunded_before_order"
  | "shelf_restored"
  | "wholesale_price_check"
  | "payment_beside_order"
  | "refund_incomplete"
  | "refund_unresolved"

export interface PaymentIssueInput {
  issue: PaymentIssue
  provider: string
  /** The provider's reference (PayTR's `merchant_oid`), or the cart for a shelf. */
  reference: string
  cart_id: string | null
  /** Kuruş, when the money is the point. */
  amount?: number | null
}

const PROVIDER_NAMES: Readonly<Record<string, string>> = {
  paytr: "PayTR",
  iyzico: "iyzico",
  "bank-transfer": "Havale/EFT",
  cod: "Kapıda ödeme",
  stock: "Stok",
  wholesale: "Toptan fiyat denetimi",
}

const amountText = (kurus: number | null | undefined) =>
  typeof kurus === "number" ? `${(kurus / 100).toFixed(2).replace(".", ",")} TRY` : "—"

/**
 * The bell, once per issue and reference, and the staff e-mail
 * (`staff.payment_issue`, on the new-order switch), once per address and
 * reference. Never fails what raised it.
 */
export async function alertPaymentIssue(
  container: Pick<MedusaContainer, "resolve">,
  input: PaymentIssueInput
): Promise<void> {
  const provider = PROVIDER_NAMES[input.provider] ?? input.provider
  const values = {
    provider,
    reference: input.reference,
    cart: input.cart_id ?? "—",
    amount: amountText(input.amount),
  }
  try {
    await container.resolve(Modules.NOTIFICATION).createNotifications({
      to: "",
      channel: "feed",
      template: "admin-ui",
      trigger_type: `payments.${input.issue}`,
      resource_id: input.cart_id ?? input.reference,
      resource_type: "cart",
      idempotency_key: `payments.${input.issue}:${input.reference}`,
      data: {
        kind: "payment_issue",
        issue: input.issue,
        provider: input.provider,
        reference: input.reference,
        cart_id: input.cart_id,
        amount: input.amount ?? null,
        ...notificationText(`payments.${input.issue}`, values),
      },
    })
  } catch (error) {
    logger.warn({
      event: "payments.issue_alert_failed",
      issue: input.issue,
      reference: input.reference,
      err: errorSummary(error),
    })
  }
  await alertStaff(container, {
    template: "staff.payment_issue",
    resource_id: `${input.issue}:${input.reference}`,
    extra: { issue: input.issue, ...values },
  })
}
