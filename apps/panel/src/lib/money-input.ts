/**
 * Amounts typed the Turkish way: "1.250,50", "1250,5", "1250.50" or "1250".
 * A comma is the decimal mark; dots before it group thousands. A lone dot
 * followed by one or two digits is read as a decimal mark too (a habit
 * from elsewhere). Returns null for anything else, so the form says so.
 */
export function parseMoneyInput(text: string): number | null {
  const value = text.trim().replace(/\s|₺|TL/gi, "")
  if (value === "") {
    return null
  }
  let normalized: string
  if (value.includes(",")) {
    const [whole = "", fraction = "", extra] = value.split(",")
    if (
      extra !== undefined ||
      !/^\d{1,3}(\.\d{3})*$|^\d+$/.test(whole) ||
      !/^\d{0,2}$/.test(fraction)
    ) {
      return null
    }
    normalized = `${whole.replace(/\./g, "")}.${fraction || "0"}`
  } else if (/^\d+\.\d{1,2}$/.test(value)) {
    normalized = value
  } else if (/^\d{1,3}(\.\d{3})+$|^\d+$/.test(value)) {
    normalized = value.replace(/\./g, "")
  } else {
    return null
  }
  const amount = Number(normalized)
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : null
}

/** An amount back into the field's form: 1250.5 → "1.250,50". */
export function formatMoneyInput(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
