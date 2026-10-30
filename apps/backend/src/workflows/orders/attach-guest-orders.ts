import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { likeLiteral } from "../../lib/db/like"
import { adoptMigratedStep } from "../migration/adopt"

/**
 * Finds the orders placed as a guest with the customer's address. Only for
 * an account with a login: the caller has signed in, so the address is
 * proven (an e-mail login is confirmed first, a social provider vouches).
 */
const findGuestOrdersStep = createStep(
  "orders-find-guest-orders",
  async (input: { customer_id: string }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["id", "email", "has_account"],
      filters: { id: input.customer_id },
    })
    const customer = customers[0] as { email: string | null; has_account: boolean } | undefined
    if (!customer?.has_account || !customer.email) {
      return new StepResponse([] as { id: string; customer_id: string }[])
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
    return new StepResponse(orders)
  }
)

/** Moves the orders to the account; undone by giving them back to their guest records. */
const moveOrdersStep = createStep(
  "orders-move-guest-orders",
  async (input: { orders: { id: string; customer_id: string }[]; to: string }, { container }) => {
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
 * before the account, with the same address, join it, and so does what a
 * migration moved with that address (F14.5). The guest records stay, so
 * nothing Medusa keeps about them is lost.
 */
export const attachGuestOrdersWorkflow = createWorkflow(
  "orders-attach-guest-orders",
  (input: { customer_id: string }) => {
    const orders = findGuestOrdersStep(input)
    const moved = moveOrdersStep({ orders, to: input.customer_id })
    adoptMigratedStep(input)
    return new WorkflowResponse(moved)
  }
)
