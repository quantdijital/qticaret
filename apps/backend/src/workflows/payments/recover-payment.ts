import type { MedusaContainer } from "@medusajs/framework/types"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { errorSummary, logger } from "../../lib/logging"
import { alertRecovery } from "../../lib/payments/recovery-alert"
import { AUDIT_LOG_MODULE } from "../../modules/audit-log"
import type AuditLogModuleService from "../../modules/audit-log/service"
import { PAYMENT_RECOVERY_MODULE } from "../../modules/payment-recovery"
import type PaymentRecoveryModuleService from "../../modules/payment-recovery/service"
import { MAX_REFUND_ATTEMPTS } from "../../modules/payment-recovery/service"
import { recoverIyzicoPayment } from "./recover-iyzico"
import { recoverPaytrPayment } from "./recover-paytr"

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
 * Gives back one payment that became no order (adr/0026 §6), each provider
 * its own way (`recover-paytr.ts`, `recover-iyzico.ts`). A failure is tried
 * again later; one that could give money back twice is left to the shop.
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
    const giveUp = async (code: string): Promise<RecoveryOutcome> => {
      await service.markAttempt(recovery.id, MAX_REFUND_ATTEMPTS, code)
      await report(container, { ...recovery, error_code: code }, "failed")
      return "failed"
    }
    const recover = recovery.provider === "iyzico" ? recoverIyzicoPayment : recoverPaytrPayment
    return new StepResponse(await recover(container, recovery, { fail, giveUp, done }))
  }
)

/** One recovery at a time: two runs of the job never refund the same payment together. */
export const recoverPaymentWorkflow = createWorkflow(
  "payments-recover-payment",
  (recoveryId: string) => {
    const key = transform({ recoveryId }, ({ recoveryId }) => `payments:recovery:${recoveryId}`)
    acquireLockStep({ key, timeout: 1, ttl: 600 })
    const outcome = refundRecoveryStep(recoveryId)
    releaseLockStep({ key })
    return new WorkflowResponse(outcome)
  }
)
