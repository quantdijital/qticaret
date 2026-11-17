/**
 * An AI cost estimate (millionths of a currency, by currency; adr/0071
 * §11) in the shop's locale: to a cent, or below one to its first
 * figures, so a fraction of a cent does not read as nothing. None: a dash.
 */
export function formatEstimate(micros: Record<string, number>): string {
  const parts = Object.entries(micros).map(([currency, amount]) =>
    new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: amount > 0 && amount < 10_000 ? 4 : 2,
    }).format(amount / 1_000_000)
  )
  return parts.length > 0 ? parts.join(" + ") : "—"
}
