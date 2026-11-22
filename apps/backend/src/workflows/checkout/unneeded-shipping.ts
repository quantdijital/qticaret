import type { ICartModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  refreshPaymentCollectionForCartWorkflow,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"

type Container = Pick<MedusaContainer, "resolve">

interface CartRow {
  completed_at?: string | Date | null
  items?: ({ requires_shipping?: boolean | null } | null)[] | null
  shipping_methods?: ({ id?: string | null } | null)[] | null
}

/**
 * The shipping methods left on an open cart that ships nothing any more
 * (adr/0076 Ek D5): its last shipped line removed, only dated or digital
 * lines stay. The checkout refuses such a cart (`cart.shipping_not_needed`)
 * and the Store API has no way to take a method off, so the server does.
 * Empty while any line ships, for a completed cart, or with no method.
 */
export async function unneededShippingMethods(
  container: Container,
  cartId: string
): Promise<string[]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["completed_at", "items.requires_shipping", "shipping_methods.id"],
    filters: { id: cartId },
  })
  const cart = (data as CartRow[])[0]
  if (!cart || cart.completed_at) {
    return []
  }
  // A line that does not say is taken as shipped, as the checkout's rule reads it
  const ships = (cart.items ?? []).some((item) => item !== null && item.requires_shipping !== false)
  if (ships) {
    return []
  }
  return (cart.shipping_methods ?? []).flatMap((method) => (method?.id ? [method.id] : []))
}

/**
 * Takes the cart's unneeded shipping methods off, read under the cart's
 * lock; given back (restored) if a later step fails, as Medusa's own
 * `removeShippingMethodFromCartStep` does.
 */
export const dropUnneededShippingStep = createStep(
  "checkout-drop-unneeded-shipping",
  async (input: { cart_id: string }, { container }) => {
    const ids = await unneededShippingMethods(container, input.cart_id)
    if (ids.length > 0) {
      await container.resolve<ICartModuleService>(Modules.CART).softDeleteShippingMethods(ids)
    }
    return new StepResponse(ids, ids)
  },
  async (ids, { container }) => {
    if (!ids?.length) {
      return
    }
    await container.resolve<ICartModuleService>(Modules.CART).restoreShippingMethods(ids)
  }
)

/**
 * The cart's unneeded shipping methods taken off under its lock, and its
 * payment collection brought to the new total (Medusa's own refresh: a
 * started session for the old amount is dropped). Answers the ids taken.
 */
export const dropUnneededShippingWorkflow = createWorkflow(
  "checkout-drop-unneeded-shipping",
  (input: { cart_id: string }) => {
    acquireLockStep({ key: input.cart_id, timeout: 5, ttl: 30 })
    const dropped = dropUnneededShippingStep(input)
    when(
      "checkout-unneeded-shipping-dropped",
      { dropped },
      ({ dropped }) => dropped.length > 0
    ).then(() => {
      refreshPaymentCollectionForCartWorkflow.runAsStep({ input: { cart_id: input.cart_id } })
    })
    releaseLockStep({ key: input.cart_id })
    return new WorkflowResponse(dropped)
  }
)
