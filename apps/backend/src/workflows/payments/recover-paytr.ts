import type { MedusaContainer } from "@medusajs/framework/types"
import { kurus } from "../../lib/money"
import { paytrApi, paytrCredentialsOf } from "../../lib/payments/paytr"
import type { PaytrPaymentStatus } from "../../lib/payments/paytr"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import { codeOf } from "./recover-iyzico"
import type { RecoveryActions } from "./recover-iyzico"
import type { RecoveryOutcome } from "./recover-payment"

/**
 * Gives back a PayTR payment that became no order (adr/0026 §6). PayTR is
 * asked first: a refund already made under our reference (an answer lost
 * on the way, `outcome_unknown`) is not made twice. Only a payment PayTR
 * shows, in the test mode it was taken in, is refunded: test keys never
 * refund a live payment. The refund is the last thing done: what follows
 * only records it, and is found again from PayTR's record if it fails.
 */
export async function recoverPaytrPayment(
  container: MedusaContainer,
  orphan: { reference: string; refund_reference: string; amount: number; test_mode: boolean },
  { fail, done }: RecoveryActions
): Promise<RecoveryOutcome> {
  const account = paytrCredentialsOf(
    await container
      .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
      .read("paytr")
  )
  if (!account) {
    return fail("not_configured")
  }
  let paid: PaytrPaymentStatus | null
  try {
    paid = await paytrApi().queryStatus(account, orphan.reference)
  } catch (error) {
    return fail(codeOf(error))
  }
  if (!paid) {
    return fail("payment_not_found")
  }
  if (paid.testMode !== orphan.test_mode) {
    return fail("test_mode_mismatch")
  }
  // Ours made already (an answer lost), or the whole payment given back another
  // way (Medusa refunds a cart's payment when completing it failed after the charge)
  const refunded = paid.refunds.reduce((sum, refund) => sum + refund.amount, 0)
  if (
    paid.refunds.some((refund) => refund.referenceNo === orphan.refund_reference) ||
    refunded >= orphan.amount
  ) {
    return done()
  }
  try {
    await paytrApi().refund(account, {
      merchantOid: orphan.reference,
      amount: kurus(orphan.amount),
      referenceNo: orphan.refund_reference,
    })
  } catch (error) {
    return fail(codeOf(error))
  }
  return done()
}
