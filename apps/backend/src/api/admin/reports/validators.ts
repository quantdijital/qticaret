import { z } from "@medusajs/framework/zod"
import { MAX_RANGE_DAYS, PERIODS } from "../../../lib/dashboard"

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "reports.range_invalid")

/** A report's days: a preset `period`, or `from` and `to` as Turkish days. */
export const REPORT_RANGE_FIELDS = {
  period: z.enum(PERIODS).optional(),
  from: day.optional(),
  to: day.optional(),
}

/** `from` and `to` come together, and never with a `period`. */
export function checkRange(
  query: { period?: string | undefined; from?: string | undefined; to?: string | undefined },
  ctx: z.RefinementCtx
): void {
  if ((query.from === undefined) !== (query.to === undefined) || (query.period && query.from)) {
    ctx.addIssue({ code: "custom", path: ["from"], message: "reports.range_invalid" })
  }
}

/**
 * A report's days (F11.1, adr/0039): a preset `period`, or `from` and `to`
 * as Turkish days (both included, at most MAX_RANGE_DAYS); 30 days when
 * neither is given.
 */
export const AdminGetReportRange = z.object(REPORT_RANGE_FIELDS).strict().superRefine(checkRange)
export type AdminGetReportRangeType = z.infer<typeof AdminGetReportRange>

/** The range a query names. */
export const rangeOf = (query: AdminGetReportRangeType) =>
  query.from && query.to
    ? { from: query.from, to: query.to }
    : { period: query.period ?? ("30d" as const) }

export { MAX_RANGE_DAYS }
