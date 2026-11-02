import { z } from "@medusajs/framework/zod"

/**
 * When the shop answers (its store details, adr/0048): ranges per ISO
 * weekday (1 Monday … 7 Sunday), more than one a day for a lunch break.
 * A day without a range is closed; no ranges at all: the shop gave none.
 * One source for the contact page, the footer and the structured data.
 */
export interface OpeningRange {
  /** ISO weekday: 1 Monday … 7 Sunday. */
  day: number
  /** `HH:MM`, 24-hour. */
  opens: string
  /** `HH:MM`, after `opens`; `24:00` for midnight. */
  closes: string
}

const OPENS = /^([01]\d|2[0-3]):[0-5]\d$/
const CLOSES = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/

const minutes = (time: string): number => {
  const [hours = "0", mins = "0"] = time.split(":")
  return Number(hours) * 60 + Number(mins)
}

const range = z
  .object({
    day: z.number().int().min(1).max(7),
    opens: z.string().regex(OPENS, { message: "platform_settings.hours_invalid" }),
    closes: z.string().regex(CLOSES, { message: "platform_settings.hours_invalid" }),
  })
  .strict()

/** Checked and sorted by day and opening; a range that ends before it opens or overlaps another is refused. */
export const openingHours = z
  .array(range)
  .max(21)
  .transform((ranges) =>
    [...ranges].sort((a, b) => a.day - b.day || minutes(a.opens) - minutes(b.opens))
  )
  .superRefine((ranges, ctx) => {
    ranges.forEach((each, index) => {
      const previous = ranges[index - 1]
      const backwards = minutes(each.closes) <= minutes(each.opens)
      const overlaps = previous?.day === each.day && minutes(each.opens) < minutes(previous.closes)
      if (backwards || overlaps) {
        ctx.addIssue({ code: "custom", message: "platform_settings.hours_invalid", path: [index] })
      }
    })
  })

/** schema.org's day names, for `OpeningHoursSpecification`. */
export const SCHEMA_DAYS: Readonly<Record<number, string>> = {
  1: "https://schema.org/Monday",
  2: "https://schema.org/Tuesday",
  3: "https://schema.org/Wednesday",
  4: "https://schema.org/Thursday",
  5: "https://schema.org/Friday",
  6: "https://schema.org/Saturday",
  7: "https://schema.org/Sunday",
}
