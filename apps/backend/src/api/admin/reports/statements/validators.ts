import { z } from "@medusajs/framework/zod"
import { turkishDay, turkishDayStart } from "../../../../lib/dashboard"
import { STATEMENT_PROVIDERS } from "../../../../lib/payments/statements"

const DAY_MS = 24 * 60 * 60 * 1000
// As far back as a statement is worth asking for again; iyzico keeps two years
const OLDEST_DAYS = 365

/**
 * A day to check again (F11.3): a closed day, yesterday at the latest,
 * within the last year.
 */
export const AdminPostStatementCheck = z
  .object({
    provider: z.enum(STATEMENT_PROVIDERS),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "statements.day_invalid"),
  })
  .strict()
  .superRefine((body, ctx) => {
    const now = Date.now()
    const yesterday = turkishDay(new Date(now - DAY_MS))
    const oldest = turkishDay(new Date(now - OLDEST_DAYS * DAY_MS))
    if (!turkishDayStart(body.day) || body.day > yesterday || body.day < oldest) {
      ctx.addIssue({ code: "custom", path: ["day"], message: "statements.day_invalid" })
    }
  })
export type AdminPostStatementCheckType = z.infer<typeof AdminPostStatementCheck>
