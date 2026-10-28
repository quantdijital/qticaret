import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  beginOrderEditOrderWorkflow,
  cancelBeginOrderEditWorkflow,
  confirmOrderEditRequestWorkflow,
  markPaymentCollectionAsPaid,
  orderEditAddNewItemWorkflow,
  orderEditUpdateItemQuantityWorkflow,
} from "@medusajs/medusa/core-flows"
import { errorSummary, logger } from "../../lib/logging"
import { kurus, toMedusaAmount } from "../../lib/money"
import { cancelLockKeys } from "../../lib/orders/locks"
import { refundOrderWorkflow } from "./refund-order"
import {
  checkOrderEditStep,
  guardOrderEditStep,
  orderEditDifferenceStep,
  unpaidCollectionStep,
} from "./steps/order-edit"
import type { OrderEditChanges } from "./steps/order-edit"

export interface OrderEditInput extends OrderEditChanges {
  order_id: string
  staff_id: string
  note: string | null
  /** The panel's key for this edit: sent again, it is made once (security review 2026-10-28). */
  reference?: string | undefined
}

/** Where an edit's key is kept: Medusa's order change's staff note (it keeps no metadata for edits). */
const noteOf = (reference: string) => `qt_edit:${reference}`

/**
 * The edit opened in Medusa (adr/0033): checked, begun, new lines added
 * at Medusa's price, lines changed; what it costs read off Medusa's
 * preview. Shared by the preview and the edit itself.
 */
function openEdit(input: OrderEditInput) {
  const check = checkOrderEditStep(
    transform({ input }, ({ input }) => ({
      order_id: input.order_id,
      items: input.items,
      add: input.add,
    }))
  )
  const change = beginOrderEditOrderWorkflow.runAsStep({
    input: transform({ input }, ({ input }) => ({
      order_id: input.order_id,
      created_by: input.staff_id,
      ...(input.note ? { description: input.note } : {}),
      ...(input.reference ? { internal_note: noteOf(input.reference) } : {}),
    })),
  })
  when("orders-edit-add", { input }, ({ input }) => input.add.length > 0).then(() => {
    orderEditAddNewItemWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({ order_id: input.order_id, items: input.add })),
    })
  })
  when("orders-edit-update", { input }, ({ input }) => input.items.length > 0).then(() => {
    orderEditUpdateItemQuantityWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({
        order_id: input.order_id,
        items: input.items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          ...(item.unit_price === undefined
            ? {}
            : { unit_price: Number(toMedusaAmount(kurus(item.unit_price))) }),
        })),
      })),
    })
  })
  const difference = orderEditDifferenceStep(
    transform({ input, check }, ({ input, check }) => ({
      order_id: input.order_id,
      pending_before: check.pending,
    }))
  )
  return { change, difference }
}

/** What an edit would cost, nothing kept: Medusa's edit opened, read, and withdrawn. */
export const previewOrderEditWorkflow = createWorkflow(
  "orders-edit-preview",
  (input: OrderEditInput) => {
    const { difference } = openEdit(input)
    cancelBeginOrderEditWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({ order_id: input.order_id })),
    })
    return new WorkflowResponse(difference)
  }
)

/**
 * The edit itself, at the difference staff saw: confirmed in Medusa (its
 * stock reserved again) and, when the shopper owes, Medusa's payment
 * collection marked paid as staff collected it. A step that fails undoes
 * the ones before it.
 */
export const applyOrderEditWorkflow = createWorkflow(
  "orders-edit-apply",
  (input: OrderEditInput & { expected: number; collected: boolean }) => {
    const { change, difference } = openEdit(input)
    guardOrderEditStep(
      transform({ input, difference }, ({ input, difference }) => ({
        difference,
        expected: input.expected,
        collected: input.collected,
      }))
    )
    confirmOrderEditRequestWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({
        order_id: input.order_id,
        confirmed_by: input.staff_id,
      })),
    })
    when("orders-edit-collected", { difference }, ({ difference }) => difference > 0).then(() => {
      const collectionId = unpaidCollectionStep(
        transform({ input, difference }, ({ input, difference }) => ({
          order_id: input.order_id,
          difference,
        }))
      )
      markPaymentCollectionAsPaid.runAsStep({
        input: transform({ input, collectionId }, ({ input, collectionId }) => ({
          payment_collection_id: collectionId,
          order_id: input.order_id,
          captured_by: input.staff_id,
        })),
      })
    })
    return new WorkflowResponse(
      transform({ change, difference }, ({ change, difference }) => ({
        change_id: change.id,
        difference,
      }))
    )
  }
)

/** The confirmed edit made under this key already, if any. */
async function editMade(
  container: MedusaContainer,
  orderId: string,
  reference: string | undefined
): Promise<string | null> {
  if (!reference) {
    return null
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order_change",
    fields: ["id", "internal_note"],
    filters: { order_id: orderId, change_type: "edit", status: "confirmed" },
  })
  const change = (data as { id: string; internal_note?: string | null }[]).find(
    (each) => each.internal_note === noteOf(reference)
  )
  return change?.id ?? null
}

const underCancelLocks = <T>(container: MedusaContainer, orderId: string, job: () => Promise<T>) =>
  container.resolve(Modules.LOCKING).execute(cancelLockKeys(orderId), job, { timeout: 10 })

/** The preview, under the order's cancel locks: an edit is not opened while one runs. */
export const previewOrderEdit = (container: MedusaContainer, input: OrderEditInput) =>
  underCancelLocks(container, input.order_id, async () => {
    const { result } = await previewOrderEditWorkflow(container).run({ input })
    return result
  })

/**
 * Edits the order (adr/0033) under its cancel locks, so it races neither
 * "Kargoya ver" nor a cancel; what the shop then owes goes back through
 * our refund (a reference of the edit's own: tried again, refunded once).
 * A refund that fails leaves the edit made, with its reason.
 */
export const editOrder = (
  container: MedusaContainer,
  input: OrderEditInput & { expected: number; collected: boolean }
) =>
  underCancelLocks(container, input.order_id, async () => {
    const made = await editMade(container, input.order_id, input.reference)
    if (made) {
      return {
        change_id: made,
        difference: null as number | null,
        refund_error: null as string | null,
      }
    }
    const { result } = await applyOrderEditWorkflow(container).run({ input })
    if (result.difference >= 0) {
      return { ...result, refund_error: null as string | null }
    }
    try {
      await refundOrderWorkflow(container).run({
        input: {
          order_id: input.order_id,
          reference: `edit${result.change_id.replace(/[^A-Za-z0-9]/g, "")}`.slice(0, 40),
          request: { balance: kurus(-result.difference) },
          note: "order edit",
          created_by: input.staff_id,
        },
      })
      return { ...result, refund_error: null as string | null }
    } catch (error) {
      logger.warn({
        event: "orders.edit_refund_failed",
        orderId: input.order_id,
        err: errorSummary(error),
      })
      const key = (error as { safeMessage?: unknown }).safeMessage
      return { ...result, refund_error: typeof key === "string" ? key : "orders.refund_failed" }
    }
  })
