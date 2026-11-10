/**
 * Numbers typed the Turkish way: "1.250,50", "1250,5", "1250.50" or "1250".
 * A comma is the decimal mark; dots before it group thousands. A lone dot
 * followed by one or two digits, or after a leading 0 ("0.125"), is read as
 * a decimal mark too (a habit from elsewhere). Returns null for anything
 * else, so the form says so. Amounts take two decimals, measurements three.
 */
export function parseDecimalInput(text: string, fractionDigits: number): number | null {
  const value = text.trim().replace(/\s|₺|TL/gi, "")
  if (value === "") {
    return null
  }
  const fraction = new RegExp(`^\\d{0,${String(fractionDigits)}}$`)
  let normalized: string
  if (value.includes(",")) {
    const [whole = "", part = "", extra] = value.split(",")
    if (extra !== undefined || !/^\d{1,3}(\.\d{3})*$|^\d+$/.test(whole) || !fraction.test(part)) {
      return null
    }
    normalized = `${whole.replace(/\./g, "")}.${part || "0"}`
  } else if (
    /^\d+\.\d{1,2}$/.test(value) ||
    new RegExp(`^0\\.\\d{1,${String(fractionDigits)}}$`).test(value)
  ) {
    normalized = value
  } else if (/^\d{1,3}(\.\d{3})+$|^\d+$/.test(value)) {
    normalized = value.replace(/\./g, "")
  } else {
    return null
  }
  const number = Number(normalized)
  const scale = 10 ** fractionDigits
  return Number.isFinite(number) ? Math.round(number * scale) / scale : null
}

export const parseMoneyInput = (text: string): number | null => parseDecimalInput(text, 2)

/** Weight and size: up to three decimals (0,125 kg). */
export const parseMeasureInput = (text: string): number | null => parseDecimalInput(text, 3)

/** A whole count (stock): "1.000" or "1000"; null for a fraction or anything else. */
export function parseCountInput(text: string): number | null {
  const value = text.trim().replace(/\s/g, "")
  return /^\d{1,3}(\.\d{3})+$|^\d+$/.test(value) ? Number(value.replace(/\./g, "")) : null
}

/** An amount back into the field's form: 1250.5 → "1.250,50". */
export function formatMoneyInput(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** A measurement back into the field: 0.125 → "0,125", 1250 → "1250" (no grouping, no padding). */
export function formatMeasureInput(value: number): string {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3, useGrouping: false }).format(
    value
  )
}
