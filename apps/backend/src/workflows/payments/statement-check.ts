import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { notificationText } from "../../lib/notifications/messages"
import { matchStatement } from "../../lib/payments/statements"
import type { StatementProvider } from "../../lib/payments/statements"
import { STATEMENT_CHECKS_MODULE } from "../../modules/statement-checks"
import type StatementChecksModuleService from "../../modules/statement-checks/service"
import type { CheckResult, StoredCheck } from "../../modules/statement-checks/service"
import { readStatementStep } from "./steps/read-statement"
import { statementPaymentsStep } from "./steps/statement-payments"

const PROVIDER_NAMES: Readonly<Record<StatementProvider, string>> = {
  paytr: "PayTR",
  iyzico: "iyzico",
}

/** Keeps the day's result; undone, the day's earlier result comes back. */
const recordCheckStep = createStep(
  "payments-record-statement-check",
  async (result: CheckResult, { container }) => {
    const { id, previous } = await container
      .resolve<StatementChecksModuleService>(STATEMENT_CHECKS_MODULE)
      .record(result)
    return new StepResponse(id, { id, previous })
  },
  async (recorded: { id: string; previous: StoredCheck | null } | undefined, { container }) => {
    if (recorded) {
      await container
        .resolve<StatementChecksModuleService>(STATEMENT_CHECKS_MODULE)
        .restore(recorded.id, recorded.previous)
    }
  }
)

/** Tells every admin, in the panel's bell, that a day's statement does not agree. Last: nothing after it can fail. */
const alertMismatchStep = createStep(
  "payments-alert-statement-mismatch",
  async (input: { id: string; result: CheckResult }, { container }) => {
    const { result } = input
    if (result.status !== "mismatched") {
      return new StepResponse(false)
    }
    try {
      await container.resolve(Modules.NOTIFICATION).createNotifications({
        to: "",
        channel: "feed",
        template: "admin-ui",
        trigger_type: "payments.statement_mismatch",
        resource_id: input.id,
        data: {
          kind: "statement_check",
          provider: result.provider,
          day: result.day,
          issues: result.issues.length,
          ...notificationText("payments.statement_mismatch", {
            provider: PROVIDER_NAMES[result.provider],
            day: result.day.split("-").reverse().join("."),
            count: result.issues.length,
          }),
        },
      })
    } catch (error) {
      logger.warn({ event: "payments.statement_alert_failed", err: errorSummary(error) })
    }
    return new StepResponse(true)
  }
)

/**
 * A provider's statement of a day against the shop's payments (F11.3,
 * adr/0039 §3): the payments taken that day must be the provider's sales,
 * the sales the shop's payments, the refunds alike on both sides. The
 * result replaces the day's earlier one; a mismatch rings the bell.
 */
export const statementCheckWorkflow = createWorkflow(
  "payments-statement-check",
  (input: WorkflowData<{ provider: StatementProvider; day: string }>) => {
    const statement = readStatementStep(input)
    const shop = statementPaymentsStep(
      transform({ input, statement }, ({ input, statement }) => ({
        provider: input.provider,
        day: input.day,
        test_mode: statement.test_mode,
        references: [...new Set(statement.rows.map((row) => row.reference))],
        skip: statement.error_code !== null,
      }))
    )
    const result = transform({ input, statement, shop }, ({ input, statement, shop }) => {
      const base = { provider: input.provider, day: input.day, checked_at: new Date() }
      if (statement.error_code !== null) {
        return {
          ...base,
          status: "failed" as const,
          matched: 0,
          sales: 0,
          issues: [],
          error_code: statement.error_code,
        }
      }
      const match = matchStatement(input.day, shop.payments, statement.rows, new Set(shop.known))
      return {
        ...base,
        status: match.issues.length > 0 ? ("mismatched" as const) : ("matched" as const),
        matched: match.matched,
        sales: match.sales,
        issues: match.issues,
        error_code: null,
      }
    })
    const id = recordCheckStep(result)
    alertMismatchStep({ id, result })
    return new WorkflowResponse(result)
  }
)
