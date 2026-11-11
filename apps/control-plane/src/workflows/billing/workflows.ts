import { MedusaError } from "@medusajs/framework/utils"
import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import type { SubscriptionStatus } from "@qticaret/types/control-plane"
import type { Advanced } from "../../modules/billing/service-subscriptions"
import type { ChargeChange, ChargeRecord, SubscriptionRecord } from "../../modules/billing/types"
import { billingIn } from "../modules"
import { undoableStep } from "../undoable"
import { refreshSubscriptionStep, tenantBillingStatusStep, termsOf } from "./steps"

/** A run's input: the shop and the Istanbul day it runs for (the clock is the caller's). */
interface DayInput {
  tenant_id: string
  today: string
}

const startStep = undoableStep(
  "cp-billing-start",
  async (input: DayInput, container) => {
    const terms = await termsOf(container, input.tenant_id)
    if (!terms) {
      return { output: { created: false, id: null as string | null }, undo: null as string | null }
    }
    const made = await billingIn(container).startSubscription(input.tenant_id, terms, input.today)
    return { output: { created: made.created, id: made.id }, undo: made.created ? made.id : null }
  },
  async (id: string | null, container) => {
    if (id) {
      const billing = billingIn(container)
      const charges = await billing.chargesOf({ subscription_id: id })
      await billing.deleteCharges(charges.map((charge) => charge.id))
      await billing.deleteSubscriptions([id])
    }
  }
)

/**
 * A shop's subscription started (adr/0061 §7, Ek C16): when it becomes
 * `active` (the setup's last step, the dev seed, the job for an active
 * shop on a package without one). Its package's trial and price; nothing
 * for a shop on no package; idempotent.
 */
export const startSubscriptionWorkflow = createWorkflow(
  { name: "cp-billing-start", store: false },
  (input: WorkflowData<DayInput>) => new WorkflowResponse(startStep(input))
)

const advanceStep = undoableStep(
  "cp-billing-advance",
  async (input: DayInput, container) => {
    const billing = billingIn(container)
    const sub = await billing.subscriptionOf(input.tenant_id)
    if (!sub) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "cp.subscription_unknown")
    }
    const advanced = await billing.advanceSubscription(
      sub.id,
      await termsOf(container, input.tenant_id),
      input.today
    )
    return { output: advanced, undo: { before: advanced.before, opened: advanced.opened } }
  },
  async (undo: { before: SubscriptionRecord; opened: string[] }, container) => {
    await billingIn(container).restoreSubscription(undo.before, undo.opened)
  }
)

/**
 * One day of a shop's subscription (Ek C16, the hourly job): the next
 * period's charge, a period rolled, its state; then the shop restricted
 * when a charge is past its grace (never suspended), or active again when
 * nothing is overdue. The plan document is the caller's, after this.
 */
export const advanceSubscriptionWorkflow = createWorkflow(
  { name: "cp-billing-advance", store: false },
  (input: WorkflowData<DayInput>) => {
    const advanced = advanceStep(input)
    const move = tenantBillingStatusStep(
      transform(
        { input, advanced },
        ({ input: run, advanced: done }: { input: DayInput; advanced: Advanced }) => ({
          tenant_id: run.tenant_id,
          status: done.status.to,
          actor: "system",
        })
      )
    )
    return new WorkflowResponse({ advanced, move })
  }
)

export interface ChargeChangeInput extends DayInput {
  charge_id: string
  change: ChargeChange
}

const changeStep = undoableStep(
  "cp-billing-charge-change",
  async (input: ChargeChangeInput, container) => {
    const before = await billingIn(container).changeCharge(
      input.tenant_id,
      input.charge_id,
      input.change
    )
    return { output: before, undo: before }
  },
  async (before: ChargeRecord, container) => {
    await billingIn(container).restoreCharge(before)
  }
)

/**
 * Staff settle or correct a charge (adr/0061 §7, Ek C16): paid, waived,
 * voided or its amount corrected; then the subscription's state, and the
 * shop back to `active` at once when nothing overdue is left (or
 * restricted, if a correction leaves it overdue).
 */
export const changeChargeWorkflow = createWorkflow(
  { name: "cp-billing-charge-change", store: false },
  (input: WorkflowData<ChargeChangeInput>) => {
    const before = changeStep(input)
    const status = refreshSubscriptionStep(
      transform(
        { input, before },
        ({ input: run, before: was }: { input: ChargeChangeInput; before: ChargeRecord }) => ({
          subscription_id: was.subscription_id,
          today: run.today,
        })
      )
    )
    const move = tenantBillingStatusStep(
      transform(
        { input, status },
        ({
          input: run,
          status: now,
        }: {
          input: ChargeChangeInput
          status: SubscriptionStatus
        }) => ({
          tenant_id: run.tenant_id,
          status: now,
          actor: run.change.actor,
        })
      )
    )
    return new WorkflowResponse({ before, status, move })
  }
)

export interface GraceInput extends DayInput {
  days: number | null
  reason: string | null
  actor: string
}

const graceStep = undoableStep(
  "cp-billing-grace",
  async (input: GraceInput, container) => {
    const billing = billingIn(container)
    const sub = await billing.subscriptionOf(input.tenant_id)
    if (!sub) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "cp.subscription_unknown")
    }
    const before = await billing.setGraceOverride(sub.id, input.days, input.reason)
    return { output: before, undo: before }
  },
  async (before: SubscriptionRecord, container) => {
    await billingIn(container).setGraceOverride(
      before.id,
      before.grace_days_override,
      before.grace_override_reason
    )
  }
)

/**
 * The shop's own grace days (adr/0061 §7 "mağaza istisnasıyla", Ek C16),
 * or back to the package's; then its state and status as the new grace
 * gives them.
 */
export const setGraceWorkflow = createWorkflow(
  { name: "cp-billing-grace", store: false },
  (input: WorkflowData<GraceInput>) => {
    const before = graceStep(input)
    const status = refreshSubscriptionStep(
      transform(
        { input, before },
        ({ input: run, before: was }: { input: GraceInput; before: SubscriptionRecord }) => ({
          subscription_id: was.id,
          today: run.today,
        })
      )
    )
    const move = tenantBillingStatusStep(
      transform(
        { input, status },
        ({ input: run, status: now }: { input: GraceInput; status: SubscriptionStatus }) => ({
          tenant_id: run.tenant_id,
          status: now,
          actor: run.actor,
        })
      )
    )
    return new WorkflowResponse({ before, status, move })
  }
)

const instructionStep = undoableStep(
  "cp-billing-instruction",
  async (input: { value: string | null; actor: string }, container) => {
    const before = await billingIn(container).setPaymentInstruction(input.value, input.actor)
    return { output: { before }, undo: { value: before, actor: input.actor } }
  },
  async (undo: { value: string | null; actor: string }, container) => {
    await billingIn(container).setPaymentInstruction(undo.value, undo.actor)
  }
)

/** The platform's payment instruction set (Ek C16); every shop's document follows (the caller's). */
export const setInstructionWorkflow = createWorkflow(
  { name: "cp-billing-instruction", store: false },
  (input: WorkflowData<{ value: string | null; actor: string }>) =>
    new WorkflowResponse(instructionStep(input))
)
