import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../lib/errors"
import {
  ORDER_NOTE_MAX,
  cleanOrderNote,
  orderNoteLength,
  withOrderNote,
} from "../../lib/orders/customer-note"

export interface SetOrderNoteInput {
  cart_id: string
  sales_channel_ids: string[]
  /** As the storefront sent it: cleaned and measured here. */
  note: string
}

interface NoteCart {
  completed_at?: unknown
  sales_channel_id?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Writes the shopper's note on their open cart (only this storefront's),
 * cleaned and within its limit; an empty note takes it off. Undone, the
 * cart's metadata is put back as it was.
 */
const setOrderNoteStep = createStep(
  "checkout-write-order-note",
  async (input: SetOrderNoteInput, { container }) => {
    const note = cleanOrderNote(input.note)
    if (orderNoteLength(note) > ORDER_NOTE_MAX) {
      throw new ValidationError("checkout.order_note_too_long", { field: "note" })
    }
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "cart",
      fields: ["id", "completed_at", "sales_channel_id", "metadata"],
      filters: { id: input.cart_id },
    })
    const cart = data[0] as NoteCart | undefined
    if (
      !cart ||
      cart.completed_at ||
      !input.sales_channel_ids.includes(cart.sales_channel_id ?? "")
    ) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "carts.unknown")
    }
    const before = cart.metadata ?? null
    await container
      .resolve(Modules.CART)
      .updateCarts(input.cart_id, { metadata: withOrderNote(before, note) })
    return new StepResponse({ note: note === "" ? null : note }, { id: input.cart_id, before })
  },
  async (previous, { container }) => {
    if (previous) {
      await container
        .resolve(Modules.CART)
        .updateCarts(previous.id, { metadata: previous.before ?? {} })
    }
  }
)

/**
 * The shopper's order note (Batch 8 / O1), under the cart's own lock: a
 * completion running at the same time reads the cart before or after it,
 * never half of it. The order takes it with the cart's metadata.
 */
export const setOrderNoteWorkflow = createWorkflow(
  "checkout-set-order-note",
  (input: SetOrderNoteInput) => {
    acquireLockStep({ key: input.cart_id, timeout: 5, ttl: 30 })
    const result = setOrderNoteStep(input)
    releaseLockStep({ key: input.cart_id })
    return new WorkflowResponse(result)
  }
)
