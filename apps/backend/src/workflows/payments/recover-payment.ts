import type { MedusaContainer } from "@medusajs/framework/types"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { isProviderError } from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import { kurus } from "../../lib/money"
import { paytrApi, paytrCredentialsOf } from "../../lib/payments/paytr"
import type { PaytrPaymentStatus } from "../../lib/payments/paytr"
import { alertRecovery } from "../../lib/payments/recovery-alert"
import { AUDIT_LOG_MODULE } from "../../modules/audit-log"
import type AuditLogModuleService from "../../modules/audit-log/service"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import { PAYMENT_RECOVERY_MODULE } from "../../modules/payment-recovery"
import type PaymentRecoveryModuleService from "../../modules/payment-recovery/service"
import { MAX_REFUND_ATTEMPTS } from "../../modules/payment-recovery/service"
import { recoverIyzicoPayment } from "./recover-iyzico"

type Recovery = Awaited<ReturnType<PaymentRecoveryModuleService["retrievePaymentRecovery"]>>

/** Providers whose orphans this workflow gives back (the job picks only these). */
export const REFUNDED_HERE: readonly string[] = ["paytr", "iyzico"]
export type RecoveryOutcome = "refunded" | "pending" | "failed" | "skipped"

/** The audit entry and the alert for a refund that went through or was given up. */
async function report(
  container: MedusaContainer,
  recovery: Recovery,
  outcome: "refunded" | "failed"
) {
  await container
    .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
    .record({
      kind: "system",
      action: outcome === "refunded" ? "payments.orphan_refunded" : "payments.orphan_refund_failed",
      resource_type: "payment_recovery",
      resource_id: recovery.id,
      outcome: outcome === "refunded" ? 200 : 502,
      changes: {
        provider: recovery.provider,
        reference: recovery.reference,
        amount: recovery.amount,
        reason: recovery.reason,
        error_code: recovery.error_code,
      },
    })
    .catch((error: unknown) => {
      logger.warn({ event: "payments.recovery_audit_failed", err: errorSummary(error) })
    })
  await alertRecovery(
    container,
    outcome === "refunded" ? "orphan_refunded" : "orphan_refund_failed",
    recovery
  ).catch((error: unknown) => {
    logger.warn({ event: "payments.recovery_alert_failed", err: errorSummary(error) })
  })
}

/**
 * Gives back one payment that became no order (adr/0026 §6). PayTR is
 * asked first: a refund already made under our reference (an answer lost
 * on the way, `outcome_unknown`) is not made twice. Only a payment PayTR
 * shows, in the test mode it was taken in, is refunded: test keys never
 * refund a live payment. The refund is the last thing done: what follows
 * only records it, and is found again from PayTR's record if it fails.
 */
export const refundRecoveryStep = createStep(
  "payments-refund-recovery",
  async (recoveryId: string, { container }) => {
    const service = container.resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
    const recovery = await service.retrievePaymentRecovery(recoveryId)
    if (recovery.status !== "pending" || !REFUNDED_HERE.includes(recovery.provider)) {
      return new StepResponse<RecoveryOutcome>("skipped")
    }
    const fail = async (code: string): Promise<RecoveryOutcome> => {
      const status = await service.markAttempt(recovery.id, recovery.attempts, code)
      if (status === "failed") {
        await report(container, { ...recovery, error_code: code }, "failed")
      }
      return status
    }
    const done = async (): Promise<RecoveryOutcome> => {
      await service.markRefunded(recovery.id)
      await report(container, recovery, "refunded")
      return "refunded"
    }
    const codeOf = (error: unknown) => (isProviderError(error) ? error.providerCode : "error")
    if (recovery.provider === "iyzico") {
      const giveUp = async (code: string): Promise<RecoveryOutcome> => {
        await service.markAttempt(recovery.id, MAX_REFUND_ATTEMPTS, code)
        await report(container, { ...recovery, error_code: code }, "failed")
        return "failed"
      }
      return new StepResponse(
        await recoverIyzicoPayment(container, recovery, { fail, giveUp, done })
      )
    }

    const account = paytrCredentialsOf(
      await container
        .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
        .read("paytr")
    )
    if (!account) {
      return new StepResponse(await fail("not_configured"))
    }
    let paid: PaytrPaymentStatus | null
    try {
      paid = await paytrApi().queryStatus(account, recovery.reference)
    } catch (error) {
      return new StepResponse(await fail(codeOf(error)))
    }
    if (!paid) {
      return new StepResponse(await fail("payment_not_found"))
    }
    if (paid.testMode !== recovery.test_mode) {
      return new StepResponse(await fail("test_mode_mismatch"))
    }
    // Ours made already (an answer lost), or the whole payment given back another
    // way (Medusa refunds a cart's payment when completing it failed after the charge)
    const refunded = paid.refunds.reduce((sum, refund) => sum + refund.amount, 0)
    if (
      paid.refunds.some((refund) => refund.referenceNo === recovery.refund_reference) ||
      refunded >= recovery.amount
    ) {
      return new StepResponse(await done())
    }
    try {
      await paytrApi().refund(account, {
        merchantOid: recovery.reference,
        amount: kurus(recovery.amount),
        referenceNo: recovery.refund_reference,
      })
    } catch (error) {
      return new StepResponse(await fail(codeOf(error)))
    }
    return new StepResponse(await done())
  }
)

export const recoverPaymentWorkflow = createWorkflow(
  "payments-recover-payment",
  (recoveryId: string) => new WorkflowResponse(refundRecoveryStep(recoveryId))
)
