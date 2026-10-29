import { ProviderError } from "../../errors"

/**
 * PayTR's `err_no` per API (dev.paytr.com/hata-kodlari, 2026-10-27) and
 * the platform's code for each. The same number means different things in
 * different APIs (`004` is a bad token in a refund, "not found" in a
 * status query), so each API has its own table. `err_msg` is never logged
 * or shown: it can quote the request.
 */

export const PAYTR_PROVIDER = "paytr"

export type PaytrEndpoint = "status" | "refund" | "installments" | "token" | "statement"

const STATUS_CODES: Readonly<Record<string, string>> = {
  "001": "merchant_invalid",
  "002": "order_invalid",
  "003": "token_invalid",
  "004": "payment_not_found",
}

const REFUND_CODES: Readonly<Record<string, string>> = {
  // Locked while PayTR pays the shop out; the same refund may be tried later
  "000": "refund_locked",
  "001": "merchant_invalid",
  "002": "order_invalid",
  "003": "amount_invalid",
  "004": "token_invalid",
  "005": "payment_not_found",
  // The refund page names 006 for what the error code page calls 009
  "006": "refund_exceeds_payment",
  "007": "payment_not_notified",
  "008": "refund_not_supported",
  "009": "refund_exceeds_payment",
  "010": "balance_insufficient",
  "011": "payment_too_old",
}

const TABLES: Readonly<Record<PaytrEndpoint, Readonly<Record<string, string>>>> = {
  status: STATUS_CODES,
  refund: REFUND_CODES,
  installments: { "006": "field_invalid" },
  token: {},
  // İşlem Dökümü documents no numbers: each stays visible as `error_<no>`
  statement: {},
}

// Worth trying again later; every other answer stands until something changes
const RETRYABLE = new Set(["refund_locked"])

/** The platform's code for PayTR's `err_no`; an unknown number stays visible as `error_<no>`. */
export function paytrErrorCode(api: PaytrEndpoint, errNo: string | undefined): string {
  const known = errNo === undefined ? undefined : TABLES[api][errNo]
  if (known) {
    return known
  }
  return errNo !== undefined && /^[A-Za-z0-9]{1,8}$/.test(errNo) ? `error_${errNo}` : "error"
}

export function paytrError(api: PaytrEndpoint, errNo: string | undefined): ProviderError {
  const providerCode = paytrErrorCode(api, errNo)
  return new ProviderError({
    provider: PAYTR_PROVIDER,
    providerCode,
    retryable: RETRYABLE.has(providerCode),
  })
}

/**
 * A failed token request names the field PayTR refused ("Zorunlu alan
 * degeri gecersiz: merchant_id"). Only a field name is kept: the text
 * after it may hold the shopper's details.
 */
export function tokenFailureCode(reason: string): string {
  const field = /gecersiz[^:]*:\s*([a-z_]{1,32})\b/i.exec(reason)?.[1]
  return field ? `token_refused_${field.toLowerCase()}` : "token_refused"
}
