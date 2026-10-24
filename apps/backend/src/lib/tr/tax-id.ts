/**
 * Turkish tax identifiers (adr/0009). Only the official check-digit
 * algorithms are applied; whether the number belongs to a real person or
 * company is not verified (no NVİ/GİB call).
 */

export const TAX_ID_KINDS = ["tckn", "vkn"] as const
export type TaxIdKind = (typeof TAX_ID_KINDS)[number]

const digitsOf = (value: string): number[] => Array.from(value, Number)

/** TC kimlik no: 11 digits, no leading zero, two check digits. */
export function isValidTckn(value: string): boolean {
  if (!/^[1-9]\d{10}$/.test(value)) {
    return false
  }
  const d = digitsOf(value)
  const at = (index: number) => d[index] ?? 0
  const odd = at(0) + at(2) + at(4) + at(6) + at(8)
  const even = at(1) + at(3) + at(5) + at(7)
  const tenth = (((odd * 7 - even) % 10) + 10) % 10
  const eleventh = d.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10
  return at(9) === tenth && at(10) === eleventh
}

/** Vergi kimlik no: 10 digits, last one is the GİB check digit. */
export function isValidVkn(value: string): boolean {
  if (!/^\d{10}$/.test(value)) {
    return false
  }
  const d = digitsOf(value)
  let sum = 0
  for (let i = 0; i < 9; i++) {
    const shifted = ((d[i] ?? 0) + 9 - i) % 10
    let weighted = (shifted * 2 ** (9 - i)) % 9
    if (shifted !== 0 && weighted === 0) {
      weighted = 9
    }
    sum += weighted
  }
  return (10 - (sum % 10)) % 10 === d[9]
}

/** Which identifier a value is, or null when it is neither. */
export function detectTaxIdKind(value: string): TaxIdKind | null {
  if (isValidTckn(value)) {
    return "tckn"
  }
  return isValidVkn(value) ? "vkn" : null
}

const LENGTH: Record<TaxIdKind, number> = { tckn: 11, vkn: 10 }

/** `*******1234` for a TCKN, `******1234` for a VKN; only the last four are shown. */
export function maskTaxId(kind: TaxIdKind, last4: string): string {
  return "*".repeat(LENGTH[kind] - last4.length) + last4
}
