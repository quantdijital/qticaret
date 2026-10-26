/**
 * A promotion code as the shop stores and a shopper types it (ADR-0024):
 * Medusa compares codes byte for byte, so "yaz10", "Yaz10" and "YAZ10"
 * would be three codes. Every code is kept in capitals with Turkish letters
 * spelled in ASCII ("İndirim" → "INDIRIM"), and every code a shopper sends
 * is read the same way.
 */

const ASCII: Readonly<Record<string, string>> = {
  ı: "I",
  i: "I",
  İ: "I",
  ş: "S",
  Ş: "S",
  ğ: "G",
  Ğ: "G",
  ü: "U",
  Ü: "U",
  ö: "O",
  Ö: "O",
  ç: "C",
  Ç: "C",
}

export function normalizeCode(code: string): string {
  return code
    .trim()
    .replace(/[ıiİşŞğĞüÜöÖçÇ]/gu, (letter) => ASCII[letter] ?? letter)
    .toUpperCase()
}

/** A code in the stored form: letters, digits, dashes and underscores, 3 to 40 of them. */
export const CODE_PATTERN = /^[A-Z0-9_-]{3,40}$/u

/**
 * Codes one Store request may send. Each request counts as one code try
 * (the coupon limit); more codes in it would be more guesses for one try.
 */
export const MAX_CODES_PER_REQUEST = 5

type Promoted = { code?: string | null; is_automatic?: boolean | null } | null

/** The codes a shopper entered on a cart: its promotions, automatic ones aside. */
export const enteredCodes = (promotions: readonly Promoted[] | null | undefined): string[] =>
  (promotions ?? []).flatMap((promotion) =>
    promotion?.code && !promotion.is_automatic ? [promotion.code] : []
  )
