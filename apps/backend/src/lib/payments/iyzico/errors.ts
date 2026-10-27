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
}

/** The platform's code for iyzico's `errorCode`; an unknown one stays visible as `error_<code>`. */
export function iyzicoErrorCode(code: string | undefined): string {
  const known = code === undefined ? undefined : CODES[code]
  if (known) {
    return known
  }
  return code !== undefined && /^[A-Za-z0-9]{1,8}$/.test(code) ? `error_${code}` : "error"
}

export const iyzicoError = (code: string | undefined): ProviderError =>
  new ProviderError({
    provider: IYZICO_PROVIDER,
    providerCode: iyzicoErrorCode(code),
    retryable: false,
  })
