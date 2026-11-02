import type { OpeningHoursView, Translate } from "@qticaret/ui"
import type { LegalIdentity } from "@qticaret/types"

type Range = LegalIdentity["opening_hours"][number]

const WEEK = [1, 2, 3, 4, 5, 6, 7] as const

/**
 * The shop's hours as a shopper reads them (adr/0048): neighbouring days
 * with the same hours together ("Pazartesi – Cuma 08:00 – 19:00"), a day
 * without hours closed. No hours at all: nothing said.
 */
export function hoursOf(ranges: readonly Range[], t: Translate): OpeningHoursView[] {
  if (ranges.length === 0) {
    return []
  }
  const dayHours = WEEK.map((day) =>
    ranges
      .filter((range) => range.day === day)
      .map((range) => t("hours.range", { opens: range.opens, closes: range.closes }))
      .join(", ")
  )
  const lines: OpeningHoursView[] = []
  let start = 0
  for (let index = 1; index <= WEEK.length; index += 1) {
    if (index < WEEK.length && dayHours[index] === dayHours[start]) {
      continue
    }
    const own = dayHours[start] ?? ""
    const first = t(`days.${String(WEEK[start])}`)
    const last = t(`days.${String(WEEK[index - 1])}`)
    lines.push({
      days: index - 1 === start ? first : t("hours.days", { first, last }),
      hours: own === "" ? t("hours.closed") : own,
    })
    start = index
  }
  return lines
}
