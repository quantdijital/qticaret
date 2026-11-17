import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../../lib/errors"
import { logger } from "../../../lib/logging"
import { fromMedusaAmount, kurus, subtractKurus } from "../../../lib/money"
import type { MedusaAmount } from "../../../lib/money"
import { planRefund } from "../../../lib/orders"
import type { PlannedLine, RefundRequest } from "../../../lib/orders"
import { HOSTED_FORM_PROVIDERS } from "../../../lib/payments/checkout"
import { ORDER_REFUNDS_MODULE } from "../../../modules/order-refunds"
import type OrderRefundsModuleService from "../../../modules/order-refunds/service"
import { alertPaymentIssue } from "../../payments/issue-alert"
import { readOrderMoney } from "../order-money"
import { refundMade, refundTraceOf } from "../refund-trace"
import { dropPendingRefund } from "./pending-refund"

export interface RefundOrderInput {
  order_id: string
  /** The request's own key (the panel makes one per refund): tried again, made once. */
  reference: string
  request: RefundRequest
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

/** The payment that can give `amount` back, a hosted form's first (adr/0026). */
async function paymentFor(
  container: Pick<MedusaContainer, "resolve">,
  orderId: string,
  amount: number
): Promise<string> {
  const payment = (await paymentRemainders(container, orderId)).find(
    (each) => each.remaining >= amount
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
 * recorded it, a later step failed) is only closed (`made`).
 */
export const planOrderRefundStep = createStep(
  "orders-plan-refund",
  async (input: RefundOrderInput, { container }) => {
    const ledger = container.resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
    const [existing] = await ledger.listOrderRefunds({ reference: input.reference }, { take: 1 })
    if (existing && existing.order_id !== input.order_id) {
      throw new ValidationError("orders.refund_reference_taken", { field: "reference" })
    }
    if (existing) {
      const done = existing.status === "done"
      return new StepResponse<RefundPlan>({
        done,
        made: !done && (await refundMade(container, existing)),
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
      entry_id: null,
      payment_id: await paymentFor(container, input.order_id, plan.total),
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
    if (plan.entry_id) {
      await ledger.updateOrderRefunds({ id: plan.entry_id, status: "pending", error_code: null })
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
 * A refund whose workflow failed. Money that left, or may have (a part
 * iyzico sent, a refund PayTR shows or the payment's data records under
 * the reference, nothing readable), keeps the entry pending as
 * `refund_incomplete`: its lines stay counted, so no new request gives
 * them back again; the same reference closes it without sending again
 * (`made`, or the provider finds its refund); the shop is told to check
 * (security review 2026-10-27, 2026-11-17). Surely none: `failed`.
 */
export async function settleFailedEntry(
  container: Pick<MedusaContainer, "resolve">,
  entryId: string
): Promise<void> {
  const ledger = container.resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
  const [entry] = await ledger.listOrderRefunds(
    { id: entryId },
    { select: ["id", "order_id", "reference", "payment_id", "amount", "provider_parts"] }
  )
  if (!entry) {
    return
  }
  const { trace, provider } = await refundTraceOf(container, {
    reference: entry.reference,
    payment_id: entry.payment_id,
    parts: ((entry.provider_parts as unknown[] | null) ?? []).length,
  })
  if (trace === "none") {
    await ledger.updateOrderRefunds({ id: entryId, status: "failed", error_code: "refund_failed" })
    return
  }
  await ledger.updateOrderRefunds({
    id: entryId,
    status: "pending",
    error_code: "refund_incomplete",
  })
  logger.error({
    event: "orders.refund_incomplete",
    orderId: entry.order_id,
    reference: entry.reference,
    trace,
  })
  await alertPaymentIssue(container, {
    issue: "refund_incomplete",
    provider,
    reference: entry.reference,
    // The order, in the alert's place for a cart: the shop finds the refund there
    cart_id: entry.order_id,
    amount: entry.amount,
  })
}

/** The refund went through: the entry is done and the payment's data no longer names it. */
export const closeRefundEntryStep = createStep(
  "orders-close-refund-entry",
  async (input: { entry_id: string; plan: RefundPlan }, { container }) => {
    if (input.plan.done) {
      return new StepResponse(null)
    }
    await container
      .resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
      .updateOrderRefunds({ id: input.entry_id, status: "done", error_code: null })
    await dropPendingRefund(container, input.plan.payment_id)
    return new StepResponse(null)
  }
)
