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
import { orderOfRecovery } from "./recovery-order"

type Recovery = Awaited<ReturnType<PaymentRecoveryModuleService["retrievePaymentRecovery"]>>

/** Providers whose orphans this workflow gives back (the job picks only these). */
export const REFUNDED_HERE: readonly string[] = ["paytr", "iyzico"]
export type RecoveryOutcome = "refunded" | "pending" | "failed" | "skipped" | "order_exists"

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
 * A payment recorded to be given back that belongs to a placed order
 * after all (finding 2026-11-16): never refunded, out of the queue for
 * good, the shop told (ids and the amount only).
 */
async function stopForOrder(
  container: MedusaContainer,
  recovery: Recovery,
  orderId: string | null
): Promise<RecoveryOutcome> {
  await container
    .resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
    .markOrderExists(recovery.id)
  logger.error({
    event: "payments.orphan_order_exists",
    recoveryId: recovery.id,
    provider: recovery.provider,
    reference: recovery.reference,
    cartId: recovery.cart_id,
    orderId,
  })
  await container
    .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
    .record({
      kind: "system",
      action: "payments.orphan_refund_stopped",
      resource_type: "payment_recovery",
      resource_id: recovery.id,
      outcome: 409,
      changes: {
        provider: recovery.provider,
        reference: recovery.reference,
        amount: recovery.amount,
        reason: recovery.reason,
        cart_id: recovery.cart_id,
        order_id: orderId,
      },
    })
    .catch((error: unknown) => {
      logger.warn({ event: "payments.recovery_audit_failed", err: errorSummary(error) })
    })
  await alertRecovery(container, "orphan_order_exists", { ...recovery, order_id: orderId }).catch(
    (error: unknown) => {
      logger.warn({ event: "payments.recovery_alert_failed", err: errorSummary(error) })
    }
  )
  return "order_exists"
}

/**
 * Gives back one payment that became no order (adr/0026 §6), each provider
 * its own way (`recover-paytr.ts`, `recover-iyzico.ts`). A payment found
 * to belong to a placed order is never given back; when that cannot be
 * read, nothing is given back this run (fail closed, tried again). A
 * failure is tried again later; one that could give money back twice is
 * left to the shop.
 */
export async function refundRecovery(
  container: MedusaContainer,
  recoveryId: string
): Promise<RecoveryOutcome> {
  const service = container.resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
  const recovery = await service.retrievePaymentRecovery(recoveryId)
  if (recovery.status !== "pending" || !REFUNDED_HERE.includes(recovery.provider)) {
    return "skipped"
  }
  let placed: { order_id: string | null } | null
  try {
    placed = await orderOfRecovery(container, recovery)
  } catch (error) {
    logger.warn({
      event: "payments.recovery_order_check_failed",
      recoveryId: recovery.id,
      err: errorSummary(error),
    })
    return "pending"
  }
  if (placed) {
    return stopForOrder(container, recovery, placed.order_id)
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
  return recover(container, recovery, { fail, giveUp, done })
}

export const refundRecoveryStep = createStep(
  "payments-refund-recovery",
  async (recoveryId: string, { container }) =>
    new StepResponse<RecoveryOutcome>(await refundRecovery(container, recoveryId))
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
