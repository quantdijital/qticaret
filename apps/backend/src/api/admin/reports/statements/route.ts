import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { turkishDay } from "../../../../lib/dashboard"
import { ValidationError } from "../../../../lib/errors"
import { kurus, toMedusaAmount } from "../../../../lib/money"
import { STATEMENT_PROVIDERS } from "../../../../lib/payments/statements"
import { STATEMENT_CHECKS_MODULE } from "../../../../modules/statement-checks"
import type StatementChecksModuleService from "../../../../modules/statement-checks/service"
import type { CheckResult } from "../../../../modules/statement-checks/service"
import { statementCheckWorkflow } from "../../../../workflows/payments/statement-check"
import { statementAccountOf } from "../../../../workflows/payments/steps/read-statement"
import { windowOf } from "../../dashboard/overview/read"
import { rangeOf } from "../validators"
import type { AdminGetReportRangeType } from "../validators"
import type { AdminPostStatementCheckType } from "./validators"

/** A check as the panel reads it: amounts in lira, as every report has them. */
const view = (check: CheckResult) => ({
  provider: check.provider,
  day: check.day,
  status: check.status,
  matched: check.matched,
  sales: check.sales,
  error_code: check.error_code,
  checked_at: check.checked_at,
  issues: check.issues.map((issue) => ({
    ...issue,
    shop: toMedusaAmount(kurus(issue.shop)),
    provider: toMedusaAmount(kurus(issue.provider)),
  })),
})

/**
 * GET /admin/reports/statements (F11.3, adr/0039 §3): the period's days
 * as PayTR's and iyzico's statements and the shop's payments agree, and
 * which providers are connected live. Staff only; references, order
 * numbers and amounts, nothing personal.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetReportRangeType>,
  res: MedusaResponse
): Promise<void> {
  const window = windowOf(rangeOf(req.validatedQuery))
  const checks = await req.scope
    .resolve<StatementChecksModuleService>(STATEMENT_CHECKS_MODULE)
    .checksBetween(turkishDay(window.from), turkishDay(new Date(window.to.getTime() - 1)))
  const providers = await Promise.all(
    STATEMENT_PROVIDERS.map(async (provider) => {
      const account = await statementAccountOf(req.scope, provider)
      return {
        provider,
        connected: account !== null,
        test_mode: account?.credentials.testMode ?? false,
      }
    })
  )
  res.json({ checks: checks.map(view), providers })
}

/** POST /admin/reports/statements: checks a closed day again, now (a provider call). */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostStatementCheckType>,
  res: MedusaResponse
): Promise<void> {
  const { provider, day } = req.validatedBody
  if (!(await statementAccountOf(req.scope, provider))) {
    throw new ValidationError("statements.account_missing", { field: "provider" })
  }
  const { result } = await statementCheckWorkflow(req.scope).run({ input: { provider, day } })
  res.json({ check: view(result) })
}
