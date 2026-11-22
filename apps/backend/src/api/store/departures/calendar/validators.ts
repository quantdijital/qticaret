import { z } from "@medusajs/framework/zod"
import { MAX_PAX, categoryOf, monthsOf, todayIn } from "../../../../lib/seo/facets-dated"

/**
 * `?month=YYYY-MM[&kategori=handle][&kisi=N]` (adr/0077 §6): one month a
 * date search reads (this month or the next eleven, facets-dated.ts), a
 * category's handle as the search writes it (its shown subtree) and the
 * party's places (1..20, 1 when not asked). Anything else is refused.
 */
export const StoreGetDepartureCalendar = z
  .object({
    month: z.string().max(7),
    kategori: z
      .string()
      .max(200)
      .refine((value) => categoryOf(value) !== null, { message: "calendar.category_invalid" })
      .optional(),
    kisi: z.coerce.number().int().min(1).max(MAX_PAX).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const months = monthsOf(value.month, todayIn(new Date()))
    if (months?.kind !== "months" || months.months.join(",") !== value.month) {
      ctx.addIssue({ code: "custom", path: ["month"], message: "calendar.month_invalid" })
    }
  })
export type StoreGetDepartureCalendarType = z.infer<typeof StoreGetDepartureCalendar>
