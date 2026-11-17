import type { MedusaContainer, UpdatePaymentDTO } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { orderRefundLockKey } from "../../../lib/orders/locks"
import type { RefundPlan } from "./order-refund"

// Medusa's update type leaves `data` out, but the module writes it (the
// HTTP test checks the provider is given our reference)
const withData = (id: string, data: Record<string, unknown>) =>
  ({ id, data }) as unknown as UpdatePaymentDTO

/** Takes the refund's name off the payment's data, nothing else: the provider may have written to it. */
export async function dropPendingRefund(
  container: Pick<MedusaContainer, "resolve">,
  paymentId: string
): Promise<boolean> {
  const payments = container.resolve(Modules.PAYMENT)
  const [payment] = await payments.listPayments({ id: paymentId }, { select: ["id", "data"] })
  if (!payment?.data || !("pending_refund" in payment.data)) {
    return false
  }
  const data = Object.fromEntries(
    Object.entries(payment.data).filter(([key]) => key !== "pending_refund")
  )
  await payments.updatePayment(withData(payment.id, data))
  return true
}

/**
 * Names the refund's reference in the payment's data, for the provider:
 * Medusa gives each try of a refund its own key, ours stays the same. A
 * refund made already, or made and only to be closed, names none.
 */
export const namePendingRefundStep = createStep(
  "orders-name-pending-refund",
  async (input: { plan: RefundPlan; reference: string }, { container }) => {
    const payments = container.resolve(Modules.PAYMENT)
    const [payment] = await payments.listPayments(
      { id: input.plan.payment_id },
      { select: ["id", "data"] }
    )
    if (input.plan.done || input.plan.made || !payment) {
      return new StepResponse<null, string | null>(null, null)
    }
    await payments.updatePayment(
      withData(payment.id, {
        ...(payment.data ?? {}),
        pending_refund: { reference_no: input.reference, amount: input.plan.amount },
      })
    )
    return new StepResponse(null, payment.id)
  },
  async (paymentId, { container }) => {
    if (paymentId) {
      await dropPendingRefund(container, paymentId)
    }
  }
)

/**
 * No payment of the order names a refund once the cancel's refunds are
 * through (security review D1, PR #149): a name a crash left behind would
 * otherwise be taken by Medusa's own refund of the same amount in the
 * cancel that follows, and that refund answered as made without sending.
 * Under the order's refund lock, so a refund under way keeps its name.
 */
export const clearPendingRefundsStep = createStep(
  "orders-clear-pending-refunds",
  async (input: { order_id: string }, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: ["payment_collections.payments.id"],
      filters: { id: input.order_id },
    })
    const order = data[0] as
      | { payment_collections?: ({ payments?: ({ id: string } | null)[] | null } | null)[] | null }
      | undefined
    const ids = (order?.payment_collections ?? [])
      .flatMap((collection) => collection?.payments ?? [])
      .flatMap((payment) => (payment ? [payment.id] : []))
    let cleared = 0
    await container.resolve(Modules.LOCKING).execute(
      orderRefundLockKey(input.order_id),
      async () => {
        for (const id of ids) {
          cleared += (await dropPendingRefund(container, id)) ? 1 : 0
        }
      },
      { timeout: 10 }
    )
    return new StepResponse(cleared)
  }
)
