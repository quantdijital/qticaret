const LOCALE = "tr-TR"
// Dashboard buckets are days in Turkey (backend lib/dashboard/period.ts)
const TIME_ZONE = "Europe/Istanbul"

/** A Medusa amount ("1250.80" or 1250.8) as money, in the shop's locale. */
export function formatMoney(amount: string | number, currencyCode: string): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: currencyCode.toUpperCase(),
  }).format(Number(amount))
}

/** Money for axes and tight spots: ₺12,5 B. */
export function formatCompactMoney(amount: string | number, currencyCode: string): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: currencyCode.toUpperCase(),
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(amount))
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat(LOCALE).format(value)
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 }).format(
    value
  )
}

/** A ratio (0.124) as a percentage: %12,4. */
export function formatPercent(ratio: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "percent",
    maximumFractionDigits: ratio < 0.1 ? 1 : 0,
  }).format(ratio)
}

export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeZone: TIME_ZONE }).format(
    new Date(value)
  )
}

export function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TIME_ZONE,
  }).format(new Date(value))
}

/** The page's date line: 26 Ekim 2026 Pazartesi. */
export function formatLongDate(value: string | Date): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: "full", timeZone: TIME_ZONE }).format(
    new Date(value)
  )
}

/** A chart bucket: the hour for today, the day otherwise. */
export function formatBucket(value: string, granularity: "hour" | "day"): string {
  const options: Intl.DateTimeFormatOptions =
    granularity === "hour"
      ? { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }
      : { day: "numeric", month: "short", timeZone: TIME_ZONE }
  return new Intl.DateTimeFormat(LOCALE, options).format(new Date(value))
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
]

/** How long ago: 5 dakika önce, 3 saat önce, dün; a date past a week. */
export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const elapsed = now.getTime() - new Date(value).getTime()
  if (elapsed >= 7 * 86_400_000) {
    return formatDate(value)
  }
  const format = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" })
  for (const [unit, size] of UNITS) {
    if (elapsed >= size) {
      return format.format(-Math.floor(elapsed / size), unit)
    }
  }
  return format.format(0, "minute")
}
