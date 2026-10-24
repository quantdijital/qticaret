const POSTAL_CODE = /^\d{5}$/
const PROVINCE_COUNT = 81

/**
 * Province plate code ("01".."81") a postal code belongs to, or null when the
 * value is not a Turkish postal code. Turkish postal codes have five digits
 * and start with the plate code of their province (adr/0008).
 */
export function postalCodePlate(value: string): string | null {
  const code = value.trim()
  if (!POSTAL_CODE.test(code)) {
    return null
  }
  const plate = code.slice(0, 2)
  const plateNumber = Number(plate)
  return plateNumber >= 1 && plateNumber <= PROVINCE_COUNT ? plate : null
}

/** Normalizes a plate code to two digits: "6" and "06" both become "06". */
export function normalizePlateCode(value: string | number): string | null {
  const text = String(value).trim()
  if (!/^\d{1,2}$/.test(text)) {
    return null
  }
  const plate = Number(text)
  return plate >= 1 && plate <= PROVINCE_COUNT ? text.padStart(2, "0") : null
}
