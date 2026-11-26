import { ProviderError } from "../../errors"

/**
 * How DHL eCommerce answers (docs/entegrasyonlar/dhlecommerce.md): one
 * object, or the same object wrapped in an array, whatever its document
 * shows; a refusal as `{error: {code, message, description}}`, its keys in
 * either case, often under HTTP 500; the API gateway's own refusals
 * (IBM API Connect) as `{httpCode, httpMessage, moreInformation}`.
 */

export const DHL_ECOMMERCE_PROVIDER = "dhlecommerce"

type Row = Record<string, unknown>

const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** The answer's one object, from the object itself or an array holding it; null for neither. */
export function oneOf(body: unknown): Row | null {
  const first: unknown = Array.isArray(body) ? body[0] : body
  return isRow(first) ? first : null
}

/** A key's value whatever its case (`code`, `Code`). */
export function field(row: Row | null | undefined, name: string): unknown {
  if (!row) {
    return undefined
  }
  const lower = name.toLowerCase()
  const key = Object.keys(row).find((each) => each.toLowerCase() === lower)
  return key === undefined ? undefined : row[key]
}

/** A value as text: a string as it is, a number written out; null otherwise. */
export function textOf(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() === "" ? null : value.trim()
  }
  return typeof value === "number" && Number.isFinite(value) ? String(value) : null
}

/** DHL's refusal in an error body: its code and its sentence (`jsonFault` of the HTTP client). */
export function dhlEcomFault(body: unknown): { code: string; text: string | null } | undefined {
  const error = field(oneOf(body), "error")
  const row = isRow(error) ? error : null
  const code = textOf(field(row, "code"))
  if (!code) {
    return undefined
  }
  return { code, text: textOf(field(row, "description")) ?? textOf(field(row, "message")) }
}

/**
 * The gateway's word for a refusal: the app has no subscription to the
 * API product called (`401 Cannot find valid subscription`), which is the
 * platform's to fix, not the shop's.
 */
export function dhlEcomGatewayCode(body: unknown): string | undefined {
  const said = textOf(field(oneOf(body), "moreInformation"))
  return said && /subscription/i.test(said) ? "subscription_missing" : undefined
}

/** An answer that is not what DHL eCommerce sends. */
export const invalid = () =>
  new ProviderError({
    provider: DHL_ECOMMERCE_PROVIDER,
    providerCode: "invalid_response",
    retryable: false,
  })

/** DHL eCommerce's codes we act on. */
export const DHL_CODES = {
  /** "BU SİPARİS NUMARASINA AİT KAYIT ZATEN VAR!": the order is there already. */
  orderExists: "error_3002",
  /** "VARIŞ ŞUBESİ BULUNAMADI": DHL has not yet found the receiver's branch. */
  branchNotFound: "error_20001",
  /** The receiver's tax number is empty. */
  taxNumberMissing: "error_26056",
  /** Test keys sent to the live host, or the reverse. */
  wrongEnvironment: "error_20013",
} as const
