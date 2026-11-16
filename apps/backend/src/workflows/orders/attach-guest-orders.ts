import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { likeLiteral } from "../../lib/db/like"
import { logger } from "../../lib/logging"
import { provenCustomer } from "../account/proven-customer"

export interface GuestOrder {
  id: string
  customer_id: string
}

/**
 * The orders placed as a guest with the customer's address that may join
 * their account. Only for a customer who has proven the address is theirs
 * (`provenCustomer`): `has_account` alone is not proof, since an e-mail
 * registration has it before its address is confirmed (security review
 * of PR #73). Most readers have no guest orders, found with one read and
 * no proof asked; an unproven customer takes nothing and does once the
 * address is confirmed or a social provider vouches for it.
 */
export async function guestOrdersToAttach(
  container: Pick<MedusaContainer, "resolve">,
  customerId: string
): Promise<GuestOrder[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "email", "has_account"],
    filters: { id: customerId },
  })
  const customer = customers[0] as { email: string | null; has_account: boolean } | undefined
  if (!customer?.has_account || !customer.email) {
    return []
  }
  const { data: guests } = await query.graph({
    entity: "customer",
    fields: ["id", "orders.id"],
    filters: { email: { $ilike: likeLiteral(customer.email) }, has_account: false },
  })
  const orders = (guests as { id: string; orders?: ({ id: string } | null)[] | null }[]).flatMap(
    (guest) =>
      (guest.orders ?? []).flatMap((order) =>
        order ? [{ id: order.id, customer_id: guest.id }] : []
      )
  )
  if (orders.length === 0) {
    return []
  }
  if (!(await provenCustomer(container, customerId))) {
    logger.info({ event: "orders.attach_guest_unproven", count: orders.length })
    return []
  }
  return orders
}

const findGuestOrdersStep = createStep(
  "orders-find-guest-orders",
  async (input: { customer_id: string }, { container }) =>
    new StepResponse(await guestOrdersToAttach(container, input.customer_id))
)

/** Moves the orders to the account; undone by giving them back to their guest records. */
const moveOrdersStep = createStep(
  "orders-move-guest-orders",
  async (input: { orders: GuestOrder[]; to: string }, { container }) => {
    const orders = container.resolve(Modules.ORDER)
    for (const order of input.orders) {
      await orders.updateOrders(order.id, { customer_id: input.to })
    }
    return new StepResponse(input.orders.length, input.orders)
  },
  async (moved, { container }) => {
    const orders = container.resolve(Modules.ORDER)
    for (const order of moved ?? []) {
      await orders.updateOrders(order.id, { customer_id: order.customer_id })
    }
  }
)

/**
 * A signed-in customer's own guest orders (adr/0037 §1): the orders placed
 * before the account, with the same address, join it once the customer has
 * proven the address (`guestOrdersToAttach`). What a migration moved with
 * that address waits for the invitation's key (F14.5): a confirmed address
 * alone does not take it. The guest records stay, so nothing Medusa keeps
 * about them is lost.
 */
export const attachGuestOrdersWorkflow = createWorkflow(
  "orders-attach-guest-orders",
  (input: { customer_id: string }) => {
    const orders = findGuestOrdersStep(input)
    return new WorkflowResponse(moveOrdersStep({ orders, to: input.customer_id }))
  }
)
