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
import { ConflictError } from "../../../lib/errors"
import { errorSummary, logger } from "../../../lib/logging"

// A customer's open carts are read this many at a time
const CART_PAGE = 100

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

type Container = Pick<MedusaContainer, "resolve">

/** Every cart of the customer not yet ordered, a page at a time. */
export async function openCartsOf(container: Container, customerId: string): Promise<string[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const ids: string[] = []
  for (let skip = 0; ; skip += CART_PAGE) {
    const { data } = await query.graph({
      entity: "cart",
      fields: ["id"],
      filters: { customer_id: customerId, completed_at: null },
      pagination: { skip, take: CART_PAGE, order: { id: "ASC" } },
    })
    ids.push(...(data as { id: string }[]).map((cart) => cart.id))
    if (data.length < CART_PAGE) {
      return ids
    }
  }
}

export interface RepriceCounts {
  repriced: number
  /** Carts that failed twice: named in the log, counted in the answer and the audit entry. */
  failed: number
}

/** One cart priced again; a failure is tried once more. */
async function repriceOne(container: Container, cartId: string): Promise<boolean> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await repriceCartWorkflow(container as MedusaContainer).run({ input: { cart_id: cartId } })
      return true
    } catch (error) {
      logger.warn({
        event: "wholesale.cart_reprice_failed",
        cart_id: cartId,
        attempt,
        err: errorSummary(error),
      })
    }
  }
  return false
}

/** Every open cart of the customer priced again from their groups as they are now. */
export async function repriceCustomerCarts(
  container: Container,
  customerId: string
): Promise<RepriceCounts> {
  const counts: RepriceCounts = { repriced: 0, failed: 0 }
  for (const cartId of await openCartsOf(container, customerId)) {
    if (await repriceOne(container, cartId)) {
      counts.repriced += 1
    } else {
      counts.failed += 1
    }
  }
  return counts
}

/**
 * The customer's open carts priced again once their groups changed
 * (ADR-0068 §3; review M1): every one of them, not only the newest; a
 * closed wholesaler's at retail, a new one's at wholesale. A cart that
 * fails is tried once more, then counted as failed in the result (the
 * route answers it and the audit entry records it), never dropped
 * silently. Until slice 4's completion hook (`wholesale.prices_changed`)
 * lands, such a cart could still check out at its old prices. Nothing to
 * undo: the prices follow the groups.
 */
export const repriceCartsStep = createStep(
  "wholesale-reprice-carts",
  async (input: { customer_id: string | null; changed: boolean }, { container }) => {
    if (!input.customer_id || !input.changed) {
      return new StepResponse<RepriceCounts>({ repriced: 0, failed: 0 })
    }
    return new StepResponse(await repriceCustomerCarts(container, input.customer_id))
  }
)

/**
 * Deleting a wholesaler (security review L3, the owner's decision): every
 * open cart must be priced at retail, or nothing is deleted. A cart still
 * failing after its retry refuses the deletion, and the workflow's undo
 * leaves the wholesaler as it was.
 */
export function assertAllRepriced(counts: RepriceCounts): RepriceCounts {
  if (counts.failed > 0) {
    throw new ConflictError("wholesale.carts_not_repriced")
  }
  return counts
}

/** `repriceCartsStep`, refusing when a cart could not be priced again (a deletion). */
export const repriceAllCartsStep = createStep(
  "wholesale-reprice-all-carts",
  async (input: { customer_id: string | null; changed: boolean }, { container }) => {
    if (!input.customer_id || !input.changed) {
      return new StepResponse<RepriceCounts>({ repriced: 0, failed: 0 })
    }
    return new StepResponse(
      assertAllRepriced(await repriceCustomerCarts(container, input.customer_id))
    )
  }
)

/**
 * Nothing on the way; on an undo, after the groups are back (it stands
 * before them), the customer's open carts priced again: a deletion
 * refused leaves its carts at wholesale, as before.
 */
export const repriceOnUndoStep = createStep(
  "wholesale-reprice-on-undo",
  (input: { customer_id: string | null }) => new StepResponse(undefined, input.customer_id),
  async (customerId, { container }) => {
    if (customerId) {
      await repriceCustomerCarts(container, customerId)
    }
  }
)
