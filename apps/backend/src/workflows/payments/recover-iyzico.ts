import type { MedusaContainer } from "@medusajs/framework/types"
import { isProviderError } from "../../lib/errors"
import { logger } from "../../lib/logging"
import { kurus } from "../../lib/money"
import {
  isIyzicoRefusal,
  iyzicoApi,
  iyzicoCredentialsOf,
  nothingDone,
  parseIyzicoPrice,
} from "../../lib/payments/iyzico"
import type { IyzicoCredentials } from "../../lib/payments/iyzico"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import type { RecoveryOutcome } from "./recover-payment"

export interface RecoveryActions {
  /** Not given back this time; tried again later. */
  fail: (code: string) => Promise<RecoveryOutcome>
  /** Left to the shop, with an alert: trying again could give money back twice. */
  giveUp: (code: string) => Promise<RecoveryOutcome>
  done: () => Promise<RecoveryOutcome>
}

interface Orphan {
  reference: string
  refund_reference: string
  amount: number
  currency_code: string
  test_mode: boolean
}

export const codeOf = (error: unknown): string =>
  isProviderError(error) ? error.providerCode : "error"

/** The payment's item transactions, once they add up to at least what iyzico's signed result took. */
async function transactionsOf(account: IyzicoCredentials, orphan: Orphan) {
  const detail = await iyzicoApi().paymentDetail(account, orphan.reference)
  const transactions = detail.itemTransactions.map((item) => ({
    id: item.paymentTransactionId,
    paid: parseIyzicoPrice(item.paidPrice),
  }))
  const total = transactions.reduce((sum, item) => sum + item.paid, 0)
  return detail.paymentId === orphan.reference && transactions.length > 0 && total >= orphan.amount
    ? transactions
    : null
}

/**
 * Gives back an iyzico payment that became no order (adr/0026 §6, F5 V10),
 * `reference` being iyzico's payment id. A cancel takes it all back the
 * same day; refused (a later day), every item transaction is refunded in
 * full. iyzico keeps no record we can read and is not idempotent: once
 * anything may have gone back (an unknown outcome, a refusal after a part
 * went through), the payment is left to the shop, never tried again.
 */
export async function recoverIyzicoPayment(
  container: MedusaContainer,
  orphan: Orphan,
  actions: RecoveryActions
): Promise<RecoveryOutcome> {
  const account = iyzicoCredentialsOf(
    await container
      .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
      .read("iyzico")
  )
  if (!account) {
    return actions.fail("not_configured")
  }
  if (account.testMode !== orphan.test_mode) {
    return actions.fail("test_mode_mismatch")
  }
  const conversationId = orphan.refund_reference
  try {
    await iyzicoApi().cancelPayment(account, { paymentId: orphan.reference, conversationId })
    return await actions.done()
  } catch (error) {
    if (!nothingDone(error)) {
      return actions.giveUp(codeOf(error))
    }
    if (!isIyzicoRefusal(error)) {
      return actions.fail(codeOf(error))
    }
    // Refused: not the payment's day (or not cancellable): refunds then
    logger.info({ event: "iyzico.orphan_cancel_refused", code: codeOf(error) })
  }
  let transactions
  try {
    transactions = await transactionsOf(account, orphan)
  } catch (error) {
    return actions.fail(codeOf(error))
  }
  if (!transactions) {
    return actions.fail("detail_mismatch")
  }
  let sent = 0
  for (const transaction of transactions) {
    try {
      const answer = await iyzicoApi().refundTransaction(account, {
        transactionId: transaction.id,
        amount: kurus(transaction.paid),
        currency: orphan.currency_code,
        conversationId,
      })
      if (answer.paymentId !== orphan.reference || answer.amount !== transaction.paid) {
        return await actions.giveUp("answer_mismatch")
      }
      sent += 1
    } catch (error) {
      return sent === 0 && nothingDone(error)
        ? actions.fail(codeOf(error))
        : actions.giveUp(codeOf(error))
    }
  }
  return actions.done()
}
