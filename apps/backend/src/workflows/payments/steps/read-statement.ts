import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { turkishDay } from "../../../lib/dashboard"
import { isProviderError } from "../../../lib/errors"
import { iyzicoApi, iyzicoCredentialsOf } from "../../../lib/payments/iyzico"
import type { IyzicoCredentials } from "../../../lib/payments/iyzico"
import { paytrApi, paytrCredentialsOf } from "../../../lib/payments/paytr"
import type { PaytrCredentials } from "../../../lib/payments/paytr"
import { aroundDay } from "../../../lib/payments/statements"
import type { StatementProvider, StatementRow } from "../../../lib/payments/statements"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../../modules/integration-credentials/service"

export type StatementAccount =
  | { provider: "paytr"; credentials: PaytrCredentials }
  | { provider: "iyzico"; credentials: IyzicoCredentials }

/** The shop's account at the provider, as stored now; null when it is not connected. */
export async function statementAccountOf(
  container: MedusaContainer,
  provider: StatementProvider
): Promise<StatementAccount | null> {
  const stored = await container
    .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
    .read(provider)
  if (provider === "paytr") {
    const credentials = paytrCredentialsOf(stored)
    return credentials ? { provider, credentials } : null
  }
  const credentials = iyzicoCredentialsOf(stored)
  return credentials ? { provider, credentials } : null
}

export interface StatementRead {
  rows: StatementRow[]
  /** The account's mode: the shop's payments of the same mode are compared. */
  test_mode: boolean
  /** Why the statement could not be read; the provider's code only. */
  error_code: string | null
}

/** The rows of the day and the days either side of it, up to today. */
async function rowsAround(account: StatementAccount, day: string): Promise<StatementRow[]> {
  const today = turkishDay(new Date())
  const { before, after } = aroundDay(day)
  const last = after > today ? today : after
  if (account.provider === "paytr") {
    // One call: PayTR gives three days at most, exactly the window
    return paytrApi().statement(account.credentials, before, last)
  }
  const rows: StatementRow[] = []
  for (const date of [before, day, after].filter((date) => date <= last)) {
    rows.push(...(await iyzicoApi().statement(account.credentials, date)))
  }
  return rows
}

/**
 * Reads the provider's statement around a day (F11.3). A read changes
 * nothing at the provider, so there is nothing to undo; a provider that
 * cannot answer makes a failed check, not a failed workflow.
 */
export const readStatementStep = createStep(
  "payments-read-statement",
  async (input: { provider: StatementProvider; day: string }, { container }) => {
    const account = await statementAccountOf(container, input.provider)
    if (!account) {
      return new StepResponse<StatementRead>({
        rows: [],
        test_mode: false,
        error_code: "account_missing",
      })
    }
    const read = { test_mode: account.credentials.testMode }
    try {
      const rows = await rowsAround(account, input.day)
      return new StepResponse<StatementRead>({ ...read, rows, error_code: null })
    } catch (error) {
      if (!isProviderError(error)) {
        throw error
      }
      return new StepResponse<StatementRead>({ ...read, rows: [], error_code: error.providerCode })
    }
  }
)
