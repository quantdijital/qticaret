/**
 * What never reaches a draft provider (adr/0005; F10.13 KK8): an
 * address, a phone number, an IBAN, an identity number or a card number
 * a shop may have typed into a product's text. Product data only goes,
 * and what reads as a person's is taken out first.
 */

const PATTERNS: readonly RegExp[] = [
  // E-mail addresses
  /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu,
  // IBANs, Turkish and others, with or without spaces
  /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g,
  // Card numbers: 13–19 digits in groups
  /\b(?:\d[ -]?){12,18}\d\b/g,
  // Phone numbers: +90, 0 and a 3-digit code, then 7 digits in groups
  /(?:\+?90[\s.-]?)?\(?0?[2-5]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/g,
  // Turkish identity numbers: 11 digits
  /\b[1-9]\d{10}\b/g,
]

/** The text with what reads as personal data replaced by `[…]`. */
export function redactPersonalData(text: string): string {
  return PATTERNS.reduce((rest, pattern) => rest.replace(pattern, "[…]"), text)
}

/** Whether the text still holds what reads as personal data. */
export const hasPersonalData = (text: string): boolean => redactPersonalData(text) !== text
