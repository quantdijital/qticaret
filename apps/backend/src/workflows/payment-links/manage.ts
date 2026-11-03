import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { ConflictError, ValidationError } from "../../lib/errors"
import { extendedEnd, isOpen } from "../../lib/payment-links/snapshot"
import { PAYMENT_LINKS_MODULE } from "../../modules/payment-links"
import type PaymentLinksModuleService from "../../modules/payment-links/service"
import { closeLinkPromotion, reopenLinkPromotion } from "./promotion"

type Container = Pick<MedusaContainer, "resolve">

const service = (container: Container) =>
  container.resolve<PaymentLinksModuleService>(PAYMENT_LINKS_MODULE)

/** The link by id; 404 for none. */
export async function linkById(container: Container, id: string) {
  const [link] = await service(container).listPaymentLinks({ id }, { take: 1 })
  if (!link) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "payment_link.unknown")
  }
  return link
}

/** The lock a link's changes and the carts opened from it take, one at a time. */
export const linkLockKey = (id: string): string => `payment-link:${id}`

/**
 * Cancels an open link (or one whose prices moved): it opens nothing more
 * and its code stops working; a cart opened from it no longer completes,
 * and a card already charged for it is refunded as a payment without an
 * order (adr/0026 §6). Undone, the link and its code come back.
 */
const cancelLinkStep = createStep(
  "payment-links-cancel",
  async (input: { id: string; actor_id: string }, { container }) => {
    const link = await linkById(container, input.id)
    if (link.status !== "open" && link.status !== "draft") {
      throw new ConflictError("payment_link.not_open")
    }
    const now = new Date()
    await service(container).updatePaymentLinks({
      id: link.id,
      status: "canceled",
      canceled_by: input.actor_id,
      closed_at: now,
    })
    await closeLinkPromotion(container, link.promotion_id)
    return new StepResponse(
      { id: link.id },
      { id: link.id, status: link.status, promotion_id: link.promotion_id }
    )
  },
  async (before, { container }) => {
    if (before) {
      await service(container).updatePaymentLinks({
        id: before.id,
        status: before.status,
        canceled_by: null,
        closed_at: null,
      })
      await reopenLinkPromotion(container, before.promotion_id)
    }
  }
)

export const cancelPaymentLinkWorkflow = createWorkflow(
  "payment-links-cancel",
  (input: { id: string; actor_id: string }) => {
    const key = transform({ input }, ({ input }) => linkLockKey(input.id))
    acquireLockStep({ key, timeout: 5, ttl: 30 })
    const result = cancelLinkStep(input)
    releaseLockStep({ key })
    return new WorkflowResponse(result)
  }
)

/**
 * Moves an open link's end later: `hours` from now, never past seven days
 * from its making (its token's own end). A link past its end is expired
 * for staff already (`shownStatus`), whether or not the hourly job has
 * written it: it is not brought back. Undone, the old end comes back.
 */
const extendLinkStep = createStep(
  "payment-links-extend",
  async (input: { id: string; hours: number }, { container }) => {
    const link = await linkById(container, input.id)
    if (!isOpen(link)) {
      throw new ConflictError("payment_link.not_open")
    }
    const end = extendedEnd(link, input.hours)
    if (!end) {
      throw new ValidationError("payment_link.extend_limit", { field: "hours" })
    }
    await service(container).updatePaymentLinks({ id: link.id, expires_at: end })
    return new StepResponse(
      { id: link.id, expires_at: end },
      { id: link.id, expires_at: new Date(link.expires_at) }
    )
  },
  async (before, { container }) => {
    if (before) {
      await service(container).updatePaymentLinks(before)
    }
  }
)

export const extendPaymentLinkWorkflow = createWorkflow(
  "payment-links-extend",
  (input: { id: string; hours: number }) => {
    const key = transform({ input }, ({ input }) => linkLockKey(input.id))
    acquireLockStep({ key, timeout: 5, ttl: 30 })
    const result = extendLinkStep(input)
    releaseLockStep({ key })
    return new WorkflowResponse(result)
  }
)
