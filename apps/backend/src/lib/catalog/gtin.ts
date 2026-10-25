/**
 * GS1 trade item numbers (GTIN-8, -12, -13, -14): digits only, a valid check
 * digit (mod 10, weights 3 and 1 from the right) and not all zeros. Medusa
 * keeps them on the variant as `ean`, `upc` or `barcode`; structured data
 * and feeds get one only when it passes, and the advisor flags the rest
 * (docs/13 §5, docs/14 P-DATA-02). Saving an invalid code is not refused:
 * shops also use these fields for in-house barcodes.
 */

const GTIN = /^(?:\d{8}|\d{12,14})$/
const ALL_ZEROS = /^0+$/

export function isValidGtin(value: string): boolean {
  if (!GTIN.test(value) || ALL_ZEROS.test(value)) {
    return false
  }
  const digits = Array.from(value, Number)
  const check = digits.pop()
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

export interface VariantCodes {
  ean?: string | null
  upc?: string | null
  barcode?: string | null
}

/** The variant's GTIN for structured data: the first valid of `ean`, `upc`, `barcode`, trimmed. */
export function variantGtin(codes: VariantCodes): string | null {
  for (const code of [codes.ean, codes.upc, codes.barcode]) {
    const trimmed = code?.trim()
    if (trimmed && isValidGtin(trimmed)) {
      return trimmed
    }
  }
  return null
}
