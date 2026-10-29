import type { MedusaContainer } from "@medusajs/framework/types"
import { turkishDay } from "../lib/dashboard"
import { errorSummary, logger } from "../lib/logging"
import { STATEMENT_PROVIDERS } from "../lib/payments/statements"
import { STATEMENT_CHECKS_MODULE } from "../modules/statement-checks"
import type StatementChecksModuleService from "../modules/statement-checks/service"
import { statementCheckWorkflow } from "../workflows/payments/statement-check"
import { statementAccountOf } from "../workflows/payments/steps/read-statement"

const DAY_MS = 24 * 60 * 60 * 1000
// A day whose statement could not be read is tried again on the next mornings
const CATCH_UP_DAYS = 3

/**
 * Yesterday's PayTR and iyzico statements against the shop's payments
 * (F11.3, adr/0039 §3), and the days before it that were never checked or
 * failed. Live accounts only: a test account's statement is no money.
 */
export async function checkStatements(
  container: MedusaContainer,
  now: Date = new Date()
): Promise<number> {
  const checks = container.resolve<StatementChecksModuleService>(STATEMENT_CHECKS_MODULE)
  let checked = 0
  for (const provider of STATEMENT_PROVIDERS) {
    const account = await statementAccountOf(container, provider)
    if (!account || account.credentials.testMode) {
      continue
    }
    for (let back = 1; back <= CATCH_UP_DAYS; back += 1) {
      const day = turkishDay(new Date(now.getTime() - back * DAY_MS))
      const earlier = back === 1 ? null : await checks.checkOf(provider, day)
      if (earlier && earlier.status !== "failed") {
        continue
      }
      try {
        await statementCheckWorkflow(container).run({ input: { provider, day } })
        checked += 1
      } catch (error) {
        logger.warn({
          event: "payments.statement_check_failed",
          provider,
          day,
          err: errorSummary(error),
        })
      }
    }
  }
  return checked
}

export default async function statementChecks(container: MedusaContainer) {
  const checked = await checkStatements(container)
  logger.info({ event: "payments.statements_checked", checked })
}

// 05:30 UTC: 08:30 in Turkey, after the providers have closed the day
export const config = {
  name: "statement-checks",
  schedule: "30 5 * * *",
}
