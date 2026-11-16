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
import { alertPaymentIssue } from "./issue-alert"
import { orderOfRecovery } from "./recovery-order"
import type { OrderCheck } from "./recovery-order"

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
 * A payment recorded to be given back that a placed order stands in the
 * way of (finding 2026-11-16), never refunded here, the shop told (ids and
 * the amount only). The order holds it: out of the queue for good
 * (`order_exists`). The order holds another payment of the cart (likely
 * paid twice, review N2): left to the shop to check and give back by hand.
 */
async function stopForOrder(
  container: MedusaContainer,
  recovery: Recovery,
  check: { kind: "held" | "beside"; order_id: string }
): Promise<RecoveryOutcome> {
  const service = container.resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
  const held = check.kind === "held"
  if (held) {
    await service.markOrderExists(recovery.id)
  } else {
    await service.markAttempt(recovery.id, MAX_REFUND_ATTEMPTS, "payment_beside_order")
  }
  logger.error({
    event: held ? "payments.orphan_order_exists" : "payments.orphan_beside_order",
    recoveryId: recovery.id,
    provider: recovery.provider,
    reference: recovery.reference,
    cartId: recovery.cart_id,
    orderId: check.order_id,
  })
  await container
    .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
    .record({
      kind: "system",
      action: held ? "payments.orphan_refund_stopped" : "payments.orphan_refund_held",
      resource_type: "payment_recovery",
      resource_id: recovery.id,
      outcome: 409,
      changes: {
        provider: recovery.provider,
        reference: recovery.reference,
        amount: recovery.amount,
        reason: recovery.reason,
        cart_id: recovery.cart_id,
        order_id: check.order_id,
      },
    })
    .catch((error: unknown) => {
      logger.warn({ event: "payments.recovery_audit_failed", err: errorSummary(error) })
    })
  if (held) {
    await alertRecovery(container, "orphan_order_exists", {
      ...recovery,
      order_id: check.order_id,
    }).catch((error: unknown) => {
      logger.warn({ event: "payments.recovery_alert_failed", err: errorSummary(error) })
    })
    return "order_exists"
  }
  // Never fails what raised it
  await alertPaymentIssue(container, {
    issue: "payment_beside_order",
    provider: recovery.provider,
    reference: recovery.reference,
    cart_id: recovery.cart_id,
    amount: recovery.amount,
  })
  return "failed"
}

/**
 * Gives back one payment that became no order (adr/0026 §6), each provider
 * its own way (`recover-paytr.ts`, `recover-iyzico.ts`). A placed order in
 * the way stops it (`stopForOrder`); when that cannot be read, nothing is
 * given back this run (fail closed), counted as a try so that one never
 * readable ends with the shop. A failure is tried again later; one that
 * could give money back twice is left to the shop.
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
  let check: OrderCheck
  try {
    check = await orderOfRecovery(container, recovery)
  } catch (error) {
    logger.warn({
      event: "payments.recovery_order_check_failed",
      recoveryId: recovery.id,
      err: errorSummary(error),
    })
    return fail("order_check_failed")
  }
  if (check?.kind === "unread") {
    return fail("order_unread")
  }
  if (check) {
    return stopForOrder(container, recovery, check)
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
