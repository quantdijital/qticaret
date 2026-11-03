/**
 * Working days as the legal texts say them (`{hazırlama_süresi}`,
 * `{kargo_süresi}`): "1–2 iş günü", "2 iş günü" when the range is one
 * day or starts at none, "aynı iş günü" for none at all. Read in a
 * sentence as "… içinde kargoya verilir".
 */
export function workingDaysText(min: number, max: number): string {
  if (max <= 0) {
    return "aynı iş günü"
  }
  return min === max || min <= 0
    ? `${String(max)} iş günü`
    : `${String(min)}–${String(max)} iş günü`
}
