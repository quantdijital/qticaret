import { signNotification } from "./signing"
import type { PaytrAccount } from "./signing"

/**
 * A PayTR notification (iFrame API step 2) as PayTR would post it, signed
 * with the account. Amounts in whole kuruş; `total_amount` exceeds
 * `payment_amount` when an installment surcharge applies.
 */

export interface NotificationInput {
  merchantOid: string
  status: "success" | "failed"
  /** Kuruş the shop asked for. */
  paymentAmount: number
  /** Kuruş charged; defaults to `paymentAmount`. */
  totalAmount?: number
  testMode?: boolean
  currency?: string
  paymentType?: "card" | "eft"
  failedReasonCode?: string
  failedReasonMsg?: string
}

export function paytrNotification(
  account: PaytrAccount,
  input: NotificationInput
): Record<string, string> {
  const total = String(input.totalAmount ?? input.paymentAmount)
  const fields: Record<string, string> = {
    merchant_oid: input.merchantOid,
    status: input.status,
    total_amount: total,
    hash: signNotification(account, {
      merchant_oid: input.merchantOid,
      status: input.status,
      total_amount: total,
    }),
    payment_type: input.paymentType ?? "card",
    currency: input.currency ?? "TL",
    payment_amount: String(input.paymentAmount),
    test_mode: input.testMode ? "1" : "0",
  }
  if (input.status === "failed") {
    fields["failed_reason_code"] = input.failedReasonCode ?? "0"
    fields["failed_reason_msg"] = input.failedReasonMsg ?? "Islem onaylanmadi"
  }
  return fields
}

/** Posts a notification as a form; the body is what the shop answered ("OK" or else). */
export async function sendPaytrNotification(
  url: string,
  fields: Record<string, string>
): Promise<{ status: number; body: string }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  })
  return { status: response.status, body: await response.text() }
}
