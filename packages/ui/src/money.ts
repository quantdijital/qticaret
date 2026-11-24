const LIRA = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * "1.250,00 TL" (docs/13 §3 writes prices so): Turkish digit groups, two
 * decimals and the TL sign after. Amounts are lira (adr/0010); the price
 * display's lira strings ("80.00") are read as numbers.
 */
export function formatLira(amount: number | string): string {
  const value = typeof amount === "string" ? Number(amount) : amount
  return `${LIRA.format(Number.isFinite(value) ? value : 0)} TL`
}

const WHOLE = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 })

/** "1.110 TL": a rounded amount (a price filter's bounds), Turkish digit groups, no decimals. */
export function formatWholeLira(amount: number): string {
  return `${WHOLE.format(Number.isFinite(amount) ? amount : 0)} TL`
}
