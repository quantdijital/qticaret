/**
 * PTT's parcel barcodes (docs/entegrasyonlar/ptt.md, "Barkod aralığı ve
 * kontrol hanesi"). PTT gives the shop a range of 12-digit numbers; each
 * parcel takes the next one with its check digit as the 13th. The check
 * digit as PTT's "Veri Yükleme Web Servisi" document (2016) works it out
 * (`275036569845` → `6`): the digits from the left times 1 and 3 in turn,
 * the sum topped up to the next multiple of ten (0 when it is one already).
 */

/** A range's number: twelve digits, leading zeros kept. */
export const PTT_SERIAL = /^\d{12}$/

/** A parcel's barcode: the twelve digits and the check digit. */
export const PTT_BARCODE = /^\d{13}$/

/** The check digit of twelve digits. */
export function pttCheckDigit(serial: string): string {
  if (!PTT_SERIAL.test(serial)) {
    throw new Error("ptt: a barcode serial is twelve digits")
  }
  let sum = 0
  for (let index = 0; index < 12; index += 1) {
    sum += Number(serial[index]) * (index % 2 === 0 ? 1 : 3)
  }
  return String((10 - (sum % 10)) % 10)
}

/** The parcel's barcode for a serial of the range. */
export const pttBarcodeOf = (serial: string): string => `${serial}${pttCheckDigit(serial)}`

/** Whether thirteen digits carry the right check digit. */
export const isPttBarcode = (value: string): boolean =>
  PTT_BARCODE.test(value) && pttCheckDigit(value.slice(0, 12)) === value.slice(12)

/** A number as a serial: twelve digits, zero-padded. */
export const serialOf = (value: number): string => String(value).padStart(12, "0")

/** How many numbers a range holds, both ends in. */
export const rangeSize = (first: string, last: string): number => Number(last) - Number(first) + 1

// Below either, the panel warns that the range is running out (a warning, never a stop)
const LOW_SHARE = 0.1
const LOW_COUNT = 50

/** Whether what is left calls for a new range soon: under 10 % of the ranges, or under 50. */
export const barcodesLow = (remaining: number, total: number): boolean =>
  remaining < LOW_COUNT || (total > 0 && remaining < total * LOW_SHARE)
