// Optional country prefix, then a 10-digit national number: landline area
// codes start with 2-4, mobiles with 5, 0850-style business lines with 8.
const TR_PHONE = /^(?:\+90|0090|90|0)?([2-58]\d{9})$/
const SEPARATORS = /[\s().-]/g

/**
 * Returns a Turkish phone number in E.164 (`+905321234567`), or null when
 * the input is not one. Accepts the usual spellings: `0532 123 45 67`,
 * `+90 (532) 123-45-67`, `5321234567`.
 */
export function normalizeTrPhone(raw: string): string | null {
  const match = TR_PHONE.exec(raw.replace(SEPARATORS, ""))
  return match?.[1] ? `+90${match[1]}` : null
}

const MOBILE = /^\+90(\d{3})(\d{3})(\d{2})(\d{2})$/

/** `+905321234567` as a Turkish reader writes it: `0532 123 45 67`; another number as it is. */
export function displayTrPhone(e164: string): string {
  const parts = MOBILE.exec(e164)
  return parts ? `0${parts.slice(1).join(" ")}` : e164
}
