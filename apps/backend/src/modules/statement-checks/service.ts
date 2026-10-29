import { MedusaService } from "@medusajs/framework/utils"
import { uniqueViolationKeys } from "../../lib/errors"
import type { StatementIssue, StatementProvider } from "../../lib/payments/statements"
import { StatementCheck } from "./models/statement-check"
import type { CHECK_STATUSES } from "./models/statement-check"

export interface CheckResult {
  provider: StatementProvider
  day: string
  test_mode: boolean
  status: (typeof CHECK_STATUSES)[number]
  matched: number
  sales: number
  issues: StatementIssue[]
  error_code: string | null
  checked_at: Date
}

export interface StoredCheck extends CheckResult {
  id: string
}

const FIELDS = [
  "id",
  "provider",
  "day",
  "test_mode",
  "status",
  "matched",
  "sales",
  "issues",
  "error_code",
  "checked_at",
]

const stored = (row: Record<string, unknown>): StoredCheck => row as unknown as StoredCheck

/** Payment statements checked against the shop (F11.3): one result per provider, day and mode. */
class StatementChecksModuleService extends MedusaService({ StatementCheck }) {
  async checkOf(
    provider: StatementProvider,
    day: string,
    testMode = false
  ): Promise<StoredCheck | null> {
    const [row] = await this.listStatementChecks(
      { provider, day, test_mode: testMode },
      { take: 1, select: FIELDS }
    )
    return row ? stored(row) : null
  }

  /**
   * Keeps the day's result, replacing an earlier one; returns what was
   * there before, for a workflow to put back.
   */
  async record(result: CheckResult): Promise<{ id: string; previous: StoredCheck | null }> {
    const data = { ...result, issues: result.issues as unknown as Record<string, unknown> }
    const previous = await this.checkOf(result.provider, result.day, result.test_mode)
    if (previous) {
      await this.updateStatementChecks({ id: previous.id, ...data })
      return { id: previous.id, previous }
    }
    try {
      const created = await this.createStatementChecks(data)
      return { id: created.id, previous: null }
    } catch (error) {
      // Checked twice at once: the later result replaces the first
      if (!uniqueViolationKeys(error)?.includes("provider")) {
        throw error
      }
      return this.record(result)
    }
  }

  /** Puts a check back as it was, or removes one that was not there. */
  async restore(id: string, previous: StoredCheck | null): Promise<void> {
    if (previous) {
      await this.updateStatementChecks({
        ...previous,
        issues: previous.issues as unknown as Record<string, unknown>,
      })
    } else {
      await this.deleteStatementChecks(id)
    }
  }

  /** The checks of the days from `from` to `to` (both included), the latest day first. */
  async checksBetween(from: string, to: string): Promise<StoredCheck[]> {
    const rows = await this.listStatementChecks(
      { day: { $gte: from, $lte: to } },
      { select: FIELDS, order: { day: "DESC", provider: "ASC" }, take: 1000 }
    )
    return rows.map(stored)
  }
}

export default StatementChecksModuleService
