/**
 * The usage summary's arithmetic (adr/0071 §11, `GET /admin/ai/usage`),
 * apart from the queries so it can be tested without a database. Days and
 * months are Turkey's, as the usage report's and the plan's
 * (`usagePeriodOf`): a call at 01:00 on the 1st counts in the new month.
 */

// Turkey keeps UTC+3 all year (as `usagePeriodOf` in @qticaret/types)
const TURKEY_OFFSET_MS = 3 * 60 * 60 * 1000

/** `YYYY-MM-DD` of `now` in Turkey. */
export const turkeyDayOf = (now: Date): string =>
  new Date(now.getTime() + TURKEY_OFFSET_MS).toISOString().slice(0, 10)

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

/** The instants a Turkey month starts and the next one starts. */
export function turkeyMonthBounds(month: string): { from: Date; to: Date } {
  if (!MONTH_PATTERN.test(month)) {
    throw new Error("ai: a month is YYYY-MM")
  }
  const year = Number(month.slice(0, 4))
  const index = Number(month.slice(5, 7)) - 1
  return {
    from: new Date(Date.UTC(year, index, 1) - TURKEY_OFFSET_MS),
    to: new Date(Date.UTC(year, index + 1, 1) - TURKEY_OFFSET_MS),
  }
}

/** A row of the summary query: one service, task, status and currency. */
export interface SummaryRow {
  service: string
  task: string
  status: string
  currency: string | null
  count: number | string
  cost: number | string | null
}

export interface AiUsageLine {
  id: string
  /** Every attempt, failed ones too. */
  count: number
  succeeded: number
  refused: number
  /** failed, timeout and cancelled. */
  failed: number
  /** Micro units by currency; an estimate from the registry's prices. */
  estimated_cost_micros: Record<string, number>
}

export interface AiUsageSummary {
  month: string
  services: AiUsageLine[]
  tasks: AiUsageLine[]
}

const emptyLine = (id: string): AiUsageLine => ({
  id,
  count: 0,
  succeeded: 0,
  refused: 0,
  failed: 0,
  estimated_cost_micros: {},
})

function add(lines: Map<string, AiUsageLine>, id: string, row: SummaryRow): void {
  const line = lines.get(id) ?? emptyLine(id)
  const count = Number(row.count)
  line.count += count
  if (row.status === "succeeded") {
    line.succeeded += count
  } else if (row.status === "refused") {
    line.refused += count
  } else {
    line.failed += count
  }
  const cost = Number(row.cost ?? 0)
  if (row.currency !== null && cost > 0) {
    line.estimated_cost_micros[row.currency] =
      (line.estimated_cost_micros[row.currency] ?? 0) + cost
  }
  lines.set(id, line)
}

/** The rows folded by service and by task, the busiest first. */
export function summaryOf(month: string, rows: readonly SummaryRow[]): AiUsageSummary {
  const services = new Map<string, AiUsageLine>()
  const tasks = new Map<string, AiUsageLine>()
  for (const row of rows) {
    add(services, row.service, row)
    add(tasks, row.task, row)
  }
  const sorted = (lines: Map<string, AiUsageLine>) =>
    [...lines.values()].sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
  return { month, services: sorted(services), tasks: sorted(tasks) }
}
