/**
 * Turkish IBANs (F6 W1): `TR`, two check digits, a five-digit bank code, a
 * reserve digit and sixteen account digits, 26 characters. The ISO 13616
 * mod-97 check is applied; whether the account exists is not verified.
 */

/** Spaces dropped, letters upper-cased: the form stored and checked. */
export const normalizeIban = (value: string): string => value.replace(/\s+/g, "").toUpperCase()

export function isValidTrIban(value: string): boolean {
  const iban = normalizeIban(value)
  if (!/^TR\d{24}$/.test(iban)) {
    return false
  }
  // The first four characters moved to the end, letters as numbers (A = 10)
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (letter) =>
    String(letter.charCodeAt(0) - 55)
  )
  let remainder = 0
  for (const digit of digits) {
    remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder === 1
}

/** In groups of four, as banks print it: "TR33 0006 1005 …". */
export const formatIban = (value: string): string =>
  normalizeIban(value).replace(/(.{4})(?=.)/g, "$1 ")
