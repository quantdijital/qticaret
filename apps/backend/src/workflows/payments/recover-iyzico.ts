import type { MedusaContainer } from "@medusajs/framework/types"
import { isProviderError } from "../../lib/errors"
import { iyzicoApi, iyzicoCredentialsOf, parseIyzicoPrice } from "../../lib/payments/iyzico"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"

type Outcome = "refunded" | "pending" | "failed" | "skipped"

export interface RecoveryActions {
  /** Not given back this time; tried again later. */
  fail: (code: string) => Promise<Outcome>
  /** Left to the shop, with an alert: trying again could give money back twice. */
  giveUp: (code: string) => Promise<Outcome>
  done: () => Promise<Outcome>
}

const codeOf = (error: unknown) => (isProviderError(error) ? error.providerCode : "error")

/**
 * Gives back an iyzico payment that became no order (adr/0026 §6, F5 V10),
 * `reference` being iyzico's payment id. A cancel takes it all back the
 * same day; later, every item transaction is refunded in full. iyzico
 * keeps no record we can read and is not idempotent: once anything may
 * have gone back (a lost answer, a refusal after a part went through),
 * the payment is left to the shop instead of being tried again.
 */
export async function recoverIyzicoPayment(
  container: MedusaContainer,
  recovery: { reference: string; refund_reference: string; test_mode: boolean },
  actions: RecoveryActions
): Promise<Outcome> {
  const account = iyzicoCredentialsOf(
    await container
      .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
      .read("iyzico")
  )
  if (!account) {
    return actions.fail("not_configured")
  }
  if (account.testMode !== recovery.test_mode) {
    return actions.fail("test_mode_mismatch")
  }
  const conversationId = recovery.refund_reference
  try {
    await iyzicoApi().cancelPayment(account, { paymentId: recovery.reference, conversationId })
    return await actions.done()
  } catch (error) {
    if (codeOf(error) === "outcome_unknown") {
      return actions.giveUp("outcome_unknown")
    }
    // Not the same day, or not cancellable: refunds then
  }
  let transactions
  try {
    transactions = (await iyzicoApi().paymentDetail(account, recovery.reference)).itemTransactions
  } catch (error) {
    return actions.fail(codeOf(error))
  }
  let sent = 0
  for (const transaction of transactions) {
    try {
      await iyzicoApi().refundTransaction(account, {
        transactionId: transaction.paymentTransactionId,
        amount: parseIyzicoPrice(transaction.paidPrice),
        conversationId,
      })
      sent += 1
    } catch (error) {
      const code = codeOf(error)
      return sent === 0 && code !== "outcome_unknown" ? actions.fail(code) : actions.giveUp(code)
    }
  }
  return actions.done()
}
