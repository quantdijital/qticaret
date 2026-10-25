const LOCALE = "tr-TR"

/** A Medusa amount ("1250.80" or 1250.8) as money, in the shop's locale. */
export function formatMoney(amount: string | number, currencyCode: string): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: currencyCode.toUpperCase(),
  }).format(Number(amount))
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat(LOCALE).format(value)
}

export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium" }).format(new Date(value))
}

export function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  )
}
