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

/** A row of the summary query: one service, task, status, currency and funding. */
export interface SummaryRow {
  service: string
  task: string
  status: string
  currency: string | null
  count: number | string
  cost: number | string | null
  /** Absent reads as `own_key` (a row of before adr/0085). */
  funding?: string | null
  /** The credits the gateway said it charged the rows (`platform_credit`). */
  credits?: number | string | null
}

/** A task's calls on the platform's credits this month and the credits they were charged. */
export interface AiCreditLine {
  id: string
  calls: number
  credits: number
}

/**
 * The month on the platform's credits (adr/0085 §3): its calls and the
 * credits the gateway charged them (its headers, never worked out here),
 * in all and by task. The control plane's ledger is the wallet's truth;
 * this is what the shop's own rows say.
 */
export interface AiPlatformCredits {
  calls: number
  credits: number
  tasks: AiCreditLine[]
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
  platform_credits: AiPlatformCredits
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
  const credited = new Map<string, AiCreditLine>()
  for (const row of rows) {
    add(services, row.service, row)
    add(tasks, row.task, row)
    if (row.funding === "platform_credit") {
      const line = credited.get(row.task) ?? { id: row.task, calls: 0, credits: 0 }
      line.calls += Number(row.count)
      line.credits += Number(row.credits ?? 0)
      credited.set(row.task, line)
    }
  }
  const sorted = (lines: Map<string, AiUsageLine>) =>
    [...lines.values()].sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
  const creditTasks = [...credited.values()].sort(
    (a, b) => b.credits - a.credits || a.id.localeCompare(b.id)
  )
  return {
    month,
    services: sorted(services),
    tasks: sorted(tasks),
    platform_credits: {
      calls: creditTasks.reduce((sum, line) => sum + line.calls, 0),
      credits: creditTasks.reduce((sum, line) => sum + line.credits, 0),
      tasks: creditTasks,
    },
  }
}
