import { z } from "@medusajs/framework/zod"
import { ValidationError } from "../../lib/errors"
import { kurus, sumKurus } from "../../lib/money"
import type { Kurus } from "../../lib/money"
import { hostedCheckout } from "../../lib/payments/checkout"
import { paytrBasketOf } from "../../lib/payments/paytr"
import type { PaytrTokenRequest } from "../../lib/payments/paytr"

/** The provider's reading of a session: what our route sent in, what the session keeps. */

/** PayTR's order reference: the session id without its underscore (letters and digits only). */
export const merchantOidOf = (sessionId: string): string => sessionId.replaceAll("_", "")

const join = (parts: (string | null | undefined)[]) =>
  parts.filter((part): part is string => Boolean(part?.trim())).join(", ")

/**
 * The token request from the route's checkout (`lib/payments/checkout`)
 * and the payment's amount. The basket must add up to the amount: the
 * route built both from the same cart, so a gap means the cart changed.
 */
export function tokenRequestOf(
  data: Record<string, unknown> | undefined,
  amount: Kurus,
  currencyCode: string
): Omit<PaytrTokenRequest, "timeoutMinutes"> {
  const sessionId = data?.["session_id"]
  const checkout = hostedCheckout.safeParse(data?.["checkout"])
  if (typeof sessionId !== "string" || !checkout.success) {
    throw new ValidationError("payments.checkout_invalid")
  }
  const { buyer, basket } = checkout.data
  if (sumKurus(basket.map((line) => kurus(line.amount))) !== amount) {
    throw new ValidationError("payments.cart_changed")
  }
  return {
    merchantOid: merchantOidOf(sessionId),
    userIp: checkout.data.ip,
    email: checkout.data.email,
    amount,
    currencyCode,
    basket: paytrBasketOf(basket.map((line) => ({ ...line, amount: kurus(line.amount) }))),
    // The shop's installment settings arrive in F5 V6: until then PayTR's own maximum
    maxInstallment: 0,
    noInstallment: false,
    userName: `${buyer.first_name} ${buyer.last_name}`.slice(0, 60),
    userAddress: join([
      buyer.address_1,
      buyer.address_2,
      buyer.postal_code,
      buyer.province,
      buyer.city,
    ]).slice(0, 400),
    userPhone: buyer.phone,
    okUrl: checkout.data.return_urls.success,
    failUrl: checkout.data.return_urls.failure,
  }
}

const sessionData = z.object({
  merchant_oid: z.string().regex(/^[A-Za-z0-9]{1,64}$/),
  amount: z.number().int().positive(),
  currency_code: z.string().min(3).max(3),
  test_mode: z.boolean(),
})

/** What a started session keeps; anything else is not one of ours. */
export function paytrSession(data: Record<string, unknown> | undefined) {
  const session = sessionData.safeParse(data)
  if (!session.success) {
    throw new ValidationError("payments.session_invalid")
  }
  return session.data
}
