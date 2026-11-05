const LIRA = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Lira as prices are written (docs/13 §3, the storefront's `formatLira`):
 * Turkish digit groups, two decimals and the TL sign after, `1.500,00 TL`.
 * The amount is in lira, not kuruş.
 */
export function formatLira(lira: number): string {
  return `${LIRA.format(lira)} TL`
}
