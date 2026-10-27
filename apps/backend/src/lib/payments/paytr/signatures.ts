import { createHmac } from "node:crypto"
import { safeEqual } from "../../security"

/**
 * PayTR's signatures (dev.paytr.com, verified 2026-10-27): every one is
 * `base64(HMAC-SHA256(merchant_key, fields joined + merchant_salt))`; the
 * fields and their order differ per API. The key and salt never travel in
 * a request body (the official Node sample sends them; not copied).
 */

export interface PaytrSecrets {
  merchantId: string
  merchantKey: string
  merchantSalt: string
}

export function paytrHmac(merchantKey: string, message: string): string {
  return createHmac("sha256", merchantKey).update(message, "utf8").digest("base64")
}

export interface TokenHashFields {
  user_ip: string
  merchant_oid: string
  email: string
  payment_amount: string
  user_basket: string
  no_installment: string
  max_installment: string
  currency: string
  test_mode: string
}

/** iFrame API step 1 (`get-token`). */
export function tokenRequestHash(secrets: PaytrSecrets, fields: TokenHashFields): string {
  const message =
    secrets.merchantId +
    fields.user_ip +
    fields.merchant_oid +
    fields.email +
    fields.payment_amount +
    fields.user_basket +
    fields.no_installment +
    fields.max_installment +
    fields.currency +
    fields.test_mode +
    secrets.merchantSalt
  return paytrHmac(secrets.merchantKey, message)
}

export interface NotificationHashFields {
  merchant_oid: string
  status: string
  total_amount: string
}

/** iFrame API step 2: what PayTR signs in its notification. Only these three fields are covered. */
export function notificationHash(secrets: PaytrSecrets, fields: NotificationHashFields): string {
  return paytrHmac(
    secrets.merchantKey,
    fields.merchant_oid + secrets.merchantSalt + fields.status + fields.total_amount
  )
}

/** Compares in constant time; an empty or missing hash never matches. */
export function isNotificationGenuine(
  secrets: PaytrSecrets,
  fields: NotificationHashFields,
  hash: string | undefined
): boolean {
  if (hash === undefined || hash === "") {
    return false
  }
  return safeEqual(hash, notificationHash(secrets, fields))
}

/** Durum Sorgu. */
export function statusQueryHash(secrets: PaytrSecrets, merchantOid: string): string {
  return paytrHmac(secrets.merchantKey, secrets.merchantId + merchantOid + secrets.merchantSalt)
}

/** İade; `reference_no` is not signed. */
export function refundHash(
  secrets: PaytrSecrets,
  merchantOid: string,
  returnAmount: string
): string {
  return paytrHmac(
    secrets.merchantKey,
    secrets.merchantId + merchantOid + returnAmount + secrets.merchantSalt
  )
}

/** Taksit Oranları Sorgulama. */
export function installmentRatesHash(secrets: PaytrSecrets, requestId: string): string {
  return paytrHmac(secrets.merchantKey, secrets.merchantId + requestId + secrets.merchantSalt)
}
