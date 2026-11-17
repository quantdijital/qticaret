/**
 * What is taken out of a product's text before it reaches an AI service
 * (adr/0005; F10.13 KK8; adr/0071 §10), by pattern: an e-mail address, a
 * Turkish phone number, an IBAN, a card number and a Turkish identity
 * number. A person's name or a postal address has no pattern and is not
 * caught here: what goes is limited to a product's own published fields,
 * and that, not this filter, is what keeps customers' data out. Moved here from
 * `lib/content-drafts` (docs/22 PR 2-1); the patterns are unchanged.
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
