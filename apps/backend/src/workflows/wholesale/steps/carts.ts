import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  refreshCartItemsWorkflow,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { errorSummary, logger } from "../../../lib/logging"

// A customer's open carts, newest first; an older one is priced again when next touched
const OPEN_CARTS = 20

/**
 * One cart's lines priced again from its customer's groups as they are
 * now (Medusa's own refresh, as `addons/set-line.ts` runs it), under the
 * cart's lock.
 */
export const repriceCartWorkflow = createWorkflow(
  "wholesale-reprice-cart",
  (input: { cart_id: string }) => {
    acquireLockStep({ key: input.cart_id, timeout: 5, ttl: 30 })
    refreshCartItemsWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({
        cart_id: input.cart_id,
        force_refresh: true,
      })),
    })
    releaseLockStep({ key: input.cart_id })
    return new WorkflowResponse({ cart_id: input.cart_id })
  }
)

/** The customer's carts not yet ordered. */
export async function openCartsOf(
  container: Pick<MedusaContainer, "resolve">,
  customerId: string
): Promise<string[]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["id"],
    filters: { customer_id: customerId, completed_at: null },
    pagination: { take: OPEN_CARTS, order: { updated_at: "DESC" } },
  })
  return (data as { id: string }[]).map((cart) => cart.id)
}

/**
 * The customer's open carts priced again once their groups changed
 * (ADR-0068 §3): a closed wholesaler's cart at retail, a new one's at
 * wholesale. Nothing to undo: the prices follow the groups. A cart that
 * fails is logged and left; checkout prices it again before payment.
 */
export const repriceCartsStep = createStep(
  "wholesale-reprice-carts",
  async (input: { customer_id: string | null; changed: boolean }, { container }) => {
    if (!input.customer_id || !input.changed) {
      return new StepResponse({ repriced: 0 })
    }
    let repriced = 0
    for (const cartId of await openCartsOf(container, input.customer_id)) {
      try {
        await repriceCartWorkflow(container).run({
          input: { cart_id: cartId },
        })
        repriced += 1
      } catch (error) {
        logger.warn({ event: "wholesale.cart_reprice_failed", err: errorSummary(error) })
      }
    }
    return new StepResponse({ repriced })
  }
)
