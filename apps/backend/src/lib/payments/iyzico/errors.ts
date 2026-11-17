import { ProviderError } from "../../errors"

/**
 * iyzico's `errorCode` and the platform's code for each. Failures come
 * back as HTTP 200 with `status: "failure"`. Only codes seen in the
 * sandbox are named (2026-10-27); the payment calls add theirs (F5 V9,
 * V10). `errorMessage` is never logged or shown: it can quote the request.
 */

export const IYZICO_PROVIDER = "iyzico"

const CODES: Readonly<Record<string, string>> = {
  // The secret key does not match the API key ("Geçersiz imza")
  "1000": "signature_invalid",
  // No such API key at this address ("api bilgileri bulunamadı"); a sandbox key live, too
  "1001": "api_key_invalid",
  "5004": "field_required",
  // The basket items do not add up to the price
  "5062": "basket_total_mismatch",
  // Nothing was paid with this checkout form's token (yet)
  "5122": "form_unpaid",
  "5124": "token_unknown",
  // A refund past what is left of its line (with the refunds before it)
  "5093": "refund_exceeds_line",
  "10245": "refund_exceeds_line",
  // The same day as the payment: a cancel takes it back instead
  "10223": "refund_same_day",
  // This card's bank takes no refunds
  "10237": "refund_not_supported",
}

/** The platform's code for iyzico's `errorCode`; an unknown one stays visible as `error_<code>`. */
export function iyzicoErrorCode(code: string | undefined): string {
  const known = code === undefined ? undefined : CODES[code]
  if (known) {
    return known
  }
  return code !== undefined && /^[A-Za-z0-9]{1,8}$/.test(code) ? `error_${code}` : "error"
}

// Errors made from iyzico's own `failure` answer: it refused, nothing was done
const refusals = new WeakSet<ProviderError>()

export function iyzicoError(code: string | undefined): ProviderError {
  const error = new ProviderError({
    provider: IYZICO_PROVIDER,
    providerCode: iyzicoErrorCode(code),
    retryable: false,
  })
  refusals.add(error)
  return error
}

/**
 * Whether iyzico itself answered `failure`: nothing was done. Any other
 * error of a call that moves money (no answer, one that does not read or
 * is not signed as expected) may hide a refund iyzico made.
 */
export const isIyzicoRefusal = (error: unknown): boolean =>
  error instanceof ProviderError && refusals.has(error)

// The platform client's codes for a call that never left (a non-repeatable request). Not
// `url_not_allowed`: a refused redirect is reported so too, after the request went (D4-3)
const NEVER_SENT = new Set(["network_error", "circuit_open"])

/**
 * Whether a call that moves money surely did nothing: iyzico refused it, or
 * it was never sent. Anything else (no answer, one that does not read or is
 * not signed as expected) may hide money iyzico moved: outcome unknown.
 */
export const nothingDone = (error: unknown): boolean =>
  isIyzicoRefusal(error) || (error instanceof ProviderError && NEVER_SENT.has(error.providerCode))
