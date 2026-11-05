/**
 * GS1 trade item numbers (GTIN-8, -12, -13, -14) as the backend reads them
 * for structured data and feeds (`apps/backend/src/lib/catalog/gtin.ts`):
 * digits only, a valid check digit, not all zeros. Spaces are dropped, as a
 * barcode printed in groups ("8 690000 000000") is typed with them.
 */

const LENGTHS = new Set([8, 12, 13, 14])

/** The code as stored: trimmed, spaces dropped. */
export const normalizeGtin = (text: string): string => text.replace(/\s+/g, "")

/** Whether the check digit fits (mod 10, weights 3 and 1 from the right). */
function checkDigitFits(code: string): boolean {
  const digits = Array.from(code, Number)
  const check = digits.pop()
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

/**
 * What is wrong with a typed barcode: `format` when it is not 8, 12, 13 or
 * 14 digits, `check` when its last digit does not fit (a typo); null when it
 * is a GTIN or empty (a product may have none).
 */
export function gtinProblem(text: string): "format" | "check" | null {
  const code = normalizeGtin(text)
  if (code === "") {
    return null
  }
  if (!/^\d+$/.test(code) || !LENGTHS.has(code.length) || /^0+$/.test(code)) {
    return "format"
  }
  return checkDigitFits(code) ? null : "check"
}
