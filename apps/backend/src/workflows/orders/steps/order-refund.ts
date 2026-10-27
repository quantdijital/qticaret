import type { UpdatePaymentDTO } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../../lib/errors"
import { fromMedusaAmount, kurus, subtractKurus } from "../../../lib/money"
import type { MedusaAmount } from "../../../lib/money"
import { planRefund } from "../../../lib/orders"
import type { PlannedLine, RefundRequest } from "../../../lib/orders"
import { HOSTED_FORM_PROVIDERS } from "../../../lib/payments/checkout"
import { ORDER_REFUNDS_MODULE } from "../../../modules/order-refunds"
import type OrderRefundsModuleService from "../../../modules/order-refunds/service"
import { readOrderMoney } from "../order-money"

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

/** The payment that can give `amount` back, a hosted form's first (adr/0026). */
async function paymentFor(
  container: Parameters<Parameters<typeof createStep>[1]>[1]["container"],
  orderId: string,
  amount: number
): Promise<string> {
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
  const payments = (order.payment_collections ?? [])
    .flatMap((collection) => collection?.payments ?? [])
    .filter((payment): payment is PaymentRow => payment !== null)
    .filter((payment) => subtractKurus(sumOf(payment.captures), sumOf(payment.refunds)) >= amount)
    .sort(
      (a, b) =>
        Number((HOSTED_FORM_PROVIDERS as readonly string[]).includes(b.provider_id ?? "")) -
        Number((HOSTED_FORM_PROVIDERS as readonly string[]).includes(a.provider_id ?? ""))
    )
  const payment = payments[0]
  if (!payment) {
    // One payment gives a refund back; splitting one over several is not done
    throw new ValidationError("orders.refund_exceeds_paid", { field: "amount" })
  }
  return payment.id
}

// Medusa's update type leaves `data` out, but the module writes it (the
// HTTP test checks the provider is given our reference)
const withData = (id: string, data: Record<string, unknown>) =>
  ({ id, data }) as unknown as UpdatePaymentDTO

/** What the refund gives back, line by line, and from which payment; read under the order's lock. */
export const planOrderRefundStep = createStep(
  "orders-plan-refund",
  async (input: RefundOrderInput, { container }) => {
    const ledger = container.resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
    const [existing] = await ledger.listOrderRefunds({ reference: input.reference }, { take: 1 })
    if (existing && existing.order_id !== input.order_id) {
      throw new ValidationError("orders.refund_reference_taken", { field: "reference" })
    }
    if (existing) {
      return new StepResponse<RefundPlan>({
        done: existing.status === "done",
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
  async (entryId, { container }) => {
    if (entryId) {
      await container
        .resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
        .updateOrderRefunds({ id: entryId, status: "failed", error_code: "refund_failed" })
    }
  }
)

/**
 * Names the refund's reference in the payment's data, for the provider:
 * Medusa gives each try of a refund its own key, ours stays the same.
 */
export const namePendingRefundStep = createStep(
  "orders-name-pending-refund",
  async (input: { plan: RefundPlan; reference: string }, { container }) => {
    const payments = container.resolve(Modules.PAYMENT)
    const [payment] = await payments.listPayments(
      { id: input.plan.payment_id },
      { select: ["id", "data"] }
    )
    const before = payment?.data ?? {}
    if (input.plan.done || !payment) {
      return new StepResponse(null, null)
    }
    await payments.updatePayment(
      withData(payment.id, {
        ...before,
        pending_refund: { reference_no: input.reference, amount: input.plan.amount },
      })
    )
    return new StepResponse(null, { id: payment.id, data: before })
  },
  async (previous, { container }) => {
    if (previous) {
      await container.resolve(Modules.PAYMENT).updatePayment(withData(previous.id, previous.data))
    }
  }
)

/** The refund went through: the entry is done and the payment's data no longer names it. */
export const closeRefundEntryStep = createStep(
  "orders-close-refund-entry",
  async (input: { entry_id: string; plan: RefundPlan }, { container }) => {
    if (input.plan.done) {
      return new StepResponse(null)
    }
    await container
      .resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
      .updateOrderRefunds({ id: input.entry_id, status: "done" })
    const payments = container.resolve(Modules.PAYMENT)
    const [payment] = await payments.listPayments(
      { id: input.plan.payment_id },
      { select: ["id", "data"] }
    )
    if (payment?.data && "pending_refund" in payment.data) {
      const data = Object.fromEntries(
        Object.entries(payment.data).filter(([key]) => key !== "pending_refund")
      )
      await payments.updatePayment(withData(payment.id, data))
    }
    return new StepResponse(null)
  }
)
