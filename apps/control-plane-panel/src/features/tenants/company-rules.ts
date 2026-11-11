/**
 * What the control plane takes for a shop's company and contacts (apps/
 * control-plane `api/admin/cp/tenants/validators.ts`), checked while typing
 * so a form says it before the save does: the VKN's and TCKN's check digits
 * (the official algorithms, server-kit `tr/tax-id`; no one is looked up),
 * the postal code and the phone as the control plane reads it (`lib/
 * tenants/phone.ts`). The control plane checks again. The company dialog
 * (C7) and the new shop wizard (C11) share them.
 */

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

/** Vergi kimlik no: 10 digits, the last one GİB's check digit. */
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

/** Whether the control plane would read the phone (Turkish as written, else `+` and its code). */
export function isPhone(value: string): boolean {
  const compact = value.trim().replace(/[\s().-]/g, "")
  const turkish = (national: string) => /^(?:[2-5]\d{9}|850\d{7})$/.test(national)
  if (compact.startsWith("+")) {
    const digits = compact.slice(1)
    if (!/^[1-9]\d{7,14}$/.test(digits)) {
      return false
    }
    return digits.startsWith("90") ? turkish(digits.slice(2)) : true
  }
  if (!/^\d+$/.test(compact)) {
    return false
  }
  if (compact.startsWith("0090")) {
    return turkish(compact.slice(4))
  }
  return turkish(compact.startsWith("0") ? compact.slice(1) : compact)
}

/** The company's checked fields, as the dialog and the wizard name them. */
export type CheckedCompanyField = "tax_number" | "tckn" | "postal_code"

const CHECKS: Record<CheckedCompanyField, (value: string) => boolean> = {
  tax_number: isValidVkn,
  tckn: isValidTckn,
  postal_code: (value) => /^\d{5}$/.test(value),
}

/** Spaces are not part of a number: `123 456 78 90` is ten digits. */
export const compact = (value: string): string => value.replace(/\s/g, "")

/** Whether a filled field is wrong (blank is never wrong: it is left to fill in later). */
export const companyFieldWrong = (field: CheckedCompanyField, value: string): boolean => {
  const typed = compact(value)
  return typed !== "" && !CHECKS[field](typed)
}

export const isCheckedField = (field: string): field is CheckedCompanyField => field in CHECKS
