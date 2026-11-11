/**
 * A contact's phone number in E.164 (`+905321234567`). Turkish numbers are
 * read as people write them (`0532 123 45 67`, `532 123 4567`, `+90 …`);
 * a number from elsewhere must start with `+` and its country code.
 * Returns null when it cannot be a phone number.
 */
export function normalizePhone(value: string): string | null {
  const compact = value.trim().replace(/[\s().-]/g, "")
  if (compact.startsWith("+")) {
    const digits = compact.slice(1)
    if (!/^[1-9]\d{7,14}$/.test(digits)) {
      return null
    }
    return digits.startsWith("90") ? turkish(digits.slice(2)) : `+${digits}`
  }
  if (!/^\d+$/.test(compact)) {
    return null
  }
  if (compact.startsWith("0090")) {
    return turkish(compact.slice(4))
  }
  return turkish(compact.startsWith("0") ? compact.slice(1) : compact)
}

// A Turkish national number: 10 digits, a mobile (5xx), a landline (2xx–4xx) or 850
function turkish(national: string): string | null {
  return /^(?:[2-5]\d{9}|850\d{7})$/.test(national) ? `+90${national}` : null
}
