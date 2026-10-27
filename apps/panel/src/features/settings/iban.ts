/**
 * Turkish IBANs as the server checks them (lib/tr/iban.ts): `TR`, 24
 * digits, the ISO 13616 mod-97 check. Checked here too so the form says
 * so before the save.
 */

export const normalizeIban = (value: string): string => value.replace(/\s+/g, "").toUpperCase()

export function isValidTrIban(value: string): boolean {
  const iban = normalizeIban(value)
  if (!/^TR\d{24}$/.test(iban)) {
    return false
  }
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (letter) =>
    String(letter.charCodeAt(0) - 55)
  )
  let remainder = 0
  for (const digit of digits) {
    remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder === 1
}

/** In groups of four, as banks print it. */
export const formatIban = (value: string): string =>
  normalizeIban(value).replace(/(.{4})(?=.)/g, "$1 ")
