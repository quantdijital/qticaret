import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../../lib/errors"
import { fromMedusaAmount } from "../../../lib/money"
import type { MedusaAmount } from "../../../lib/money"
import { isCancelRefundReference } from "../../../lib/orders/locks"
import { isOfflineProvider } from "../../../lib/payments/checkout"
import { EINVOICE_MODULE } from "../../../modules/einvoice"
import type EinvoiceModuleService from "../../../modules/einvoice/service"
import { ORDER_REFUNDS_MODULE } from "../../../modules/order-refunds"
import type OrderRefundsModuleService from "../../../modules/order-refunds/service"
import { refuseBookingEdits } from "../../booking/order-edit"

export interface OrderEditChanges {
  /** Existing lines: a new quantity (0 takes the line off), a corrected unit price (kuruş). */
  items: { id: string; quantity: number; unit_price?: number | undefined }[]
  /** New lines, at Medusa's price. */
  add: { variant_id: string; quantity: number }[]
}

interface EditOrderRow {
  status?: string
  summary?: { pending_difference?: MedusaAmount | null } | null
  items?: ({ id: string; metadata?: unknown } | null)[] | null
  fulfillments?: ({ canceled_at?: unknown } | null)[] | null
  payment_collections?:
    | ({
        status?: string | null
        payments?:
          | ({
              provider_id?: string | null
              captured_at?: unknown
              canceled_at?: unknown
            } | null)[]
          | null
      } | null)[]
    | null
}

// Query may hand dates back as Date objects: compared by time, not by text
const timeOf = (value: unknown): number =>
  value instanceof Date || typeof value === "string" ? new Date(value).getTime() : 0

const pendingOf = (amount: MedusaAmount | null | undefined): number =>
  fromMedusaAmount(amount ?? 0, { allowRounding: true })

/**
 * Whether the order can be edited now (adr/0033): nothing packed, not
 * cancelled or done, no cancel refund, paid by card and taken (an offline
 * payment's amount is not Medusa's to change), and the changes name its
 * own lines, something at all. What is owed on it before, for the
 * difference.
 */
export const checkOrderEditStep = createStep(
  "orders-edit-check",
  async (input: { order_id: string } & OrderEditChanges, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: [
        "status",
        "summary",
        "items.id",
        "items.metadata",
        "fulfillments.canceled_at",
        "payment_collections.status",
        "payment_collections.payments.provider_id",
        "payment_collections.payments.captured_at",
        "payment_collections.payments.canceled_at",
      ],
      filters: { id: input.order_id },
    })
    const order = data[0] as EditOrderRow | undefined
    if (!order) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
    }
    if (input.items.length + input.add.length === 0) {
      throw new ValidationError("orders.edit_nothing", { field: "items" })
    }
    const lines = new Set((order.items ?? []).flatMap((item) => (item ? [item.id] : [])))
    const ids = new Set(input.items.map((item) => item.id))
    if (ids.size !== input.items.length || input.items.some((item) => !lines.has(item.id))) {
      throw new ValidationError("orders.edit_items_invalid", { field: "items" })
    }
    // A departure's places do not follow an edit (adr/0076 Ek, until D7)
    await refuseBookingEdits(container, order.items ?? [], input)
    const packed = (order.fulfillments ?? []).some((each) => each && !each.canceled_at)
    if (order.status === "canceled" || order.status === "completed" || packed) {
      throw new ValidationError("orders.edit_after_packing")
    }
    // An invoice on its way or issued names the order as it was (adr/0033 §8, adr/0034)
    const [invoiced] = await container.resolve<EinvoiceModuleService>(EINVOICE_MODULE).listInvoices(
      {
        order_id: input.order_id,
        kind: "sale",
        status: ["pending", "issuing", "issued", "failed"],
      },
      { select: ["id"], take: 1 }
    )
    if (invoiced) {
      throw new ValidationError("orders.edit_invoiced")
    }
    const refunds = await container
      .resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
      .listOrderRefunds(
        { order_id: input.order_id, status: ["pending", "done"] },
        { select: ["reference"] }
      )
    if (refunds.some((refund) => isCancelRefundReference(refund.reference))) {
      throw new ValidationError("orders.edit_after_packing")
    }
    // A refund outside an edit: Medusa books it as a credit, and an edit taking the same
    // line off would give it back again (security review 2026-10-28)
    if (refunds.some((refund) => !refund.reference.startsWith("edit"))) {
      throw new ValidationError("orders.edit_balance_open")
    }
    const collections = (order.payment_collections ?? []).filter(
      (collection): collection is NonNullable<typeof collection> => collection !== null
    )
    const payments = collections
      .flatMap((collection) => collection.payments ?? [])
      .filter((payment): payment is NonNullable<typeof payment> => Boolean(payment))
      .filter((payment) => !payment.canceled_at)
    const unsupported =
      payments.length === 0 ||
      collections.some((collection) => collection.status === "awaiting") ||
      payments.some(
        (payment) => !payment.captured_at || isOfflineProvider(payment.provider_id ?? "")
      )
    if (unsupported) {
      throw new ValidationError("orders.edit_payment_unsupported")
    }
    // Money already moved outside the lines (a refund, a collection) would ride along with the
    // edit's difference: refunded twice, or marked collected unasked (security review 2026-10-28)
    const pending = pendingOf(order.summary?.pending_difference)
    if (pending !== 0) {
      throw new ValidationError("orders.edit_balance_open")
    }
    return new StepResponse({ pending })
  }
)

/** What the edit costs the shopper as Medusa sums it, before it is confirmed (kuruş, positive when they owe). */
export const orderEditDifferenceStep = createStep(
  "orders-edit-difference",
  async (input: { order_id: string; pending_before: number }, { container }) => {
    const preview = await container.resolve(Modules.ORDER).previewOrderChange(input.order_id)
    const summary = (preview as { summary?: { pending_difference?: MedusaAmount | null } }).summary
    return new StepResponse(pendingOf(summary?.pending_difference) - input.pending_before)
  }
)

/**
 * The difference staff saw on the preview is still the one, and what the
 * shopper owes was collected (staff say so) before Medusa confirms.
 */
export const guardOrderEditStep = createStep(
  "orders-edit-guard",
  (input: { difference: number; expected: number; collected: boolean }) => {
    if (input.difference !== input.expected) {
      throw new ValidationError("orders.edit_difference_changed")
    }
    if (input.difference > 0 && !input.collected) {
      throw new ValidationError("orders.edit_difference_due")
    }
    return new StepResponse(input.difference)
  }
)

/** The payment collection Medusa opened for what the shopper owes, the latest unpaid one. */
export const unpaidCollectionStep = createStep(
  "orders-edit-unpaid-collection",
  async (input: { order_id: string; difference: number }, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: [
        "payment_collections.id",
        "payment_collections.status",
        "payment_collections.amount",
        "payment_collections.created_at",
      ],
      filters: { id: input.order_id },
    })
    const rows =
      (
        data[0] as
          | {
              payment_collections?:
                | ({
                    id: string
                    status?: string | null
                    amount?: MedusaAmount | null
                    created_at?: unknown
                  } | null)[]
                | null
            }
          | undefined
      )?.payment_collections ?? []
    const collection = rows
      .filter((each) => each?.status === "not_paid")
      .sort((a, b) => timeOf(b?.created_at) - timeOf(a?.created_at))[0]
    if (
      !collection ||
      fromMedusaAmount(collection.amount ?? 0, { allowRounding: true }) !== input.difference
    ) {
      throw new ValidationError("orders.edit_balance_open")
    }
    return new StepResponse(collection.id)
  }
)
