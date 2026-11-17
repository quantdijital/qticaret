import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ConflictError, ValidationError } from "../../../lib/errors"
import { fromMedusaAmount, kurus, subtractKurus } from "../../../lib/money"
import type { MedusaAmount } from "../../../lib/money"
import { planRefund } from "../../../lib/orders"
import type { PlannedLine, RefundRequest } from "../../../lib/orders"
import { HOSTED_FORM_PROVIDERS } from "../../../lib/payments/checkout"
import { ORDER_REFUNDS_MODULE } from "../../../modules/order-refunds"
import type OrderRefundsModuleService from "../../../modules/order-refunds/service"
import type { ProviderPart } from "../../../modules/order-refunds/service"
import { finishCheckedRecord } from "../made-refund-record"
import { readOrderMoney } from "../order-money"
import { settleFailedEntry, tracedOf } from "../refund-settle"
import { refundTraceOf } from "../refund-trace"
import { referenceTaken, triedAgain } from "./order-refund-guard"
import { dropPendingRefund } from "./pending-refund"

export interface RefundOrderInput {
  order_id: string
  /** The request's own key (the panel makes one per refund): tried again, made once. */
  reference: string
  request: RefundRequest
  /**
   * The payment to give it back from (a cancel's, one refund per payment);
   * none: the first that can, a hosted form's first. A reference made
   * before for another payment is refused (security review Y1).
   */
  payment_id?: string
  /**
   * Only close an open refund (the settling job's, a cancel's settling of
   * what is open): one no longer open is left as it is, never sent (D-3).
   */
  close_only?: boolean
  note?: string | null
  created_by?: string | null
}

export interface RefundPlan {
  /** Made already under this reference: nothing to do. */
  done: boolean
  /**
   * Made by the provider and recorded by Medusa under this reference, the
   * ledger not closed (a step after failed): closed now, nothing asked again.
   */
  made: boolean
  /** A refund under this reference that did not go through, tried again as it was. */
  entry_id: string | null
  payment_id: string
  amount: number
  lines: PlannedLine[]
}

type Amount = MedusaAmount | null | undefined
interface PaymentRow {
  id: string
  provider_id?: string | null
  captures?: ({ raw_amount?: Amount } | null)[] | null
  refunds?: ({ raw_amount?: Amount } | null)[] | null
}

const kurusOf = (amount: Amount) =>
  amount === null || amount === undefined
    ? kurus(0)
    : fromMedusaAmount(amount, { allowRounding: true })

const sumOf = (rows: ({ raw_amount?: Amount } | null)[] | null | undefined) =>
  kurus((rows ?? []).reduce((sum, row) => sum + kurusOf(row?.raw_amount), 0))

/**
 * What each of the order's payments can still give back, a hosted form's
 * first (adr/0026): kuruş taken less kuruş refunded.
 */
export async function paymentRemainders(
  container: Pick<MedusaContainer, "resolve">,
  orderId: string
): Promise<{ id: string; remaining: number }[]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: [
      "payment_collections.payments.id",
      "payment_collections.payments.provider_id",
      "payment_collections.payments.captures.amount",
      "payment_collections.payments.captures.raw_amount",
      "payment_collections.payments.refunds.amount",
      "payment_collections.payments.refunds.raw_amount",
    ],
    filters: { id: orderId },
  })
  const order = data[0] as
    | { payment_collections?: ({ payments?: (PaymentRow | null)[] | null } | null)[] | null }
    | undefined
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
  }
  return (order.payment_collections ?? [])
    .flatMap((collection) => collection?.payments ?? [])
    .filter((payment): payment is PaymentRow => payment !== null)
    .sort(
      (a, b) =>
        Number((HOSTED_FORM_PROVIDERS as readonly string[]).includes(b.provider_id ?? "")) -
        Number((HOSTED_FORM_PROVIDERS as readonly string[]).includes(a.provider_id ?? ""))
    )
    .map((payment) => ({
      id: payment.id,
      remaining: subtractKurus(sumOf(payment.captures), sumOf(payment.refunds)),
    }))
}

/** The payment that can give `amount` back: the one named, or a hosted form's first (adr/0026). */
async function paymentFor(
  container: Pick<MedusaContainer, "resolve">,
  orderId: string,
  amount: number,
  named?: string
): Promise<string> {
  const payment = (await paymentRemainders(container, orderId)).find(
    (each) => (named === undefined || each.id === named) && each.remaining >= amount
  )
  if (!payment) {
    // One payment gives a refund back; splitting one over several is not done
    throw new ValidationError("orders.refund_exceeds_paid", { field: "amount" })
  }
  return payment.id
}

/**
 * What the refund gives back, line by line, and from which payment; read
 * under the order's lock. Tried again under its reference, a refund the
 * payment's data records already (the provider gave it back and Medusa
 * recorded it, a later step failed) is only closed (`made`); one the
 * provider shows (`shown`) is recorded through the provider, which finds
 * it and sends nothing. Any other refund still open (its money may have
 * left, a crash left it) is never sent again (`orders.refund_unsettled`):
 * the settling job or the shop's check settles it (review 2026-11-17, O1).
 * Only a failed one is made again, planned anew from the request (D-4).
 */
export const planOrderRefundStep = createStep(
  "orders-plan-refund",
  async (input: RefundOrderInput, { container }) => {
    const ledger = container.resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
    const [existing] = await ledger.listOrderRefunds({ reference: input.reference }, { take: 1 })
    if (existing && referenceTaken(existing, input)) {
      throw new ValidationError("orders.refund_reference_taken", { field: "reference" })
    }
    const trace =
      existing?.status === "pending"
        ? (await refundTraceOf(container, tracedOf(existing))).trace
        : null
    let action = existing
      ? triedAgain(existing.status, trace, input.close_only === true)
      : input.close_only
        ? "done"
        : "replan"
    // A staff check already wrote Medusa's record: the payment's data finished from it, and the
    // refund closed as made, never recorded again through the provider (fifth and sixth rounds)
    if (
      existing &&
      (action === "send" || action === "made") &&
      (await finishCheckedRecord(container, existing))
    ) {
      action = "made"
    }
    if (!existing && action === "done") {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.refund_unknown")
    }
    if (action === "unsettled") {
      throw new ConflictError("orders.refund_unsettled")
    }
    if (existing && action !== "replan") {
      return new StepResponse<RefundPlan>({
        done: action === "done",
        made: action === "made",
        entry_id: existing.id,
        payment_id: existing.payment_id,
        amount: existing.amount,
        lines: existing.lines as unknown as PlannedLine[],
      })
    }
    const money = await readOrderMoney(container, input.order_id)
    const plan = planRefund(
      money.lines,
      await ledger.refundedLines(input.order_id),
      input.request,
      money.refundable
    )
    return new StepResponse<RefundPlan>({
      done: false,
      made: false,
      entry_id: existing?.id ?? null,
      payment_id: await paymentFor(container, input.order_id, plan.total, input.payment_id),
      amount: plan.total,
      lines: plan.lines,
    })
  }
)

/** The ledger's entry, pending until the refund went through; a refund that failed is kept as failed. */
export const openRefundEntryStep = createStep(
  "orders-open-refund-entry",
  async (input: { order: RefundOrderInput; plan: RefundPlan }, { container }) => {
    const ledger = container.resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
    const { order, plan } = input
    if (plan.done) {
      return new StepResponse(plan.entry_id ?? "", null)
    }
    // Tried again: a failed refund as planned now, one made or shown as it was
    if (plan.entry_id) {
      await ledger.updateOrderRefunds({
        id: plan.entry_id,
        status: "pending",
        error_code: null,
        payment_id: plan.payment_id,
        amount: plan.amount,
        lines: plan.lines as unknown as Record<string, unknown>,
      })
      return new StepResponse(plan.entry_id, plan.entry_id)
    }
    const entry = await ledger.createOrderRefunds({
      order_id: order.order_id,
      reference: order.reference,
      payment_id: plan.payment_id,
      amount: plan.amount,
      status: "pending",
      lines: plan.lines as unknown as Record<string, unknown>,
      note: order.note ?? null,
      created_by: order.created_by ?? null,
    })
    return new StepResponse(entry.id, entry.id)
  },
  // The refund failed somewhere: whether its money left decides the entry (review 2026-11-17)
  async (entryId, { container }) => {
    if (entryId) {
      await settleFailedEntry(container, entryId)
    }
  }
)

/**
 * The refund went through: its iyzico parts all answered, the payment's
 * data no longer naming it, the entry done. A part left `sending` (its
 * answer lost, the refund then shown made: review O4-1) is marked done,
 * so it never blocks the payment's next refunds.
 */
export async function closeRefundEntry(
  container: Pick<MedusaContainer, "resolve">,
  entryId: string,
  paymentId: string
): Promise<void> {
  const ledger = container.resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
  const [entry] = await ledger.listOrderRefunds(
    { id: entryId },
    { select: ["reference", "provider_parts"] }
  )
  const parts = (entry?.provider_parts as ProviderPart[] | null) ?? []
  if (entry && parts.some((part) => part.state === "sending")) {
    await ledger.saveProviderParts(
      entry.reference,
      parts.map((part) => ({ ...part, state: "done" as const }))
    )
  }
  await dropPendingRefund(container, paymentId)
  await ledger.updateOrderRefunds({ id: entryId, status: "done", error_code: null })
}

export const closeRefundEntryStep = createStep(
  "orders-close-refund-entry",
  async (input: { entry_id: string; plan: RefundPlan }, { container }) => {
    if (!input.plan.done) {
      await closeRefundEntry(container, input.entry_id, input.plan.payment_id)
    }
    return new StepResponse(null)
  }
)
