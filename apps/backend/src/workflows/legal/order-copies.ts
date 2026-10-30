import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { isLegalKind } from "../../lib/legal"
import { errorSummary, logger } from "../../lib/logging"
import { LEGAL_MODULE } from "../../modules/legal"
import type LegalModuleService from "../../modules/legal/service"
import type { AcceptedDocument } from "../../modules/legal/service"
import { orderContract, renderContract } from "./contracts"

interface Undo {
  consent_id: string | null
  copies: string[]
}

/**
 * The cart's consent becomes the order's, and each accepted contract is
 * kept as the order made it (adr/0041 §2): that exact version, filled
 * with the order's details and the shop's as they are now. Run again (the
 * hourly sweep), it keeps only what is missing.
 */
const keepOrderContractsStep = createStep(
  "legal-keep-order-contracts",
  async (input: { order_id: string }, { container }) => {
    const order = await orderContract(container, input.order_id)
    const service = container.resolve<LegalModuleService>(LEGAL_MODULE)
    const [consent] = order?.cart_id
      ? await service.listLegalConsents({ cart_id: order.cart_id }, { take: 1 })
      : []
    if (!order || !consent) {
      const nothing: Undo = { consent_id: null, copies: [] }
      return new StepResponse({ kept: 0 }, nothing)
    }
    const undo: Undo = { consent_id: null, copies: [] }
    const accepted = (consent.documents as unknown as AcceptedDocument[]).filter((each) =>
      isLegalKind(each.kind)
    )
    const documents = await service.listLegalDocuments({
      id: accepted.map((each) => each.document_id),
    })
    for (const document of documents) {
      const kept = await service.keepOrderCopy({
        order_id: input.order_id,
        kind: document.kind,
        version: document.version,
        document_id: document.id,
        title: document.title,
        html: await renderContract(container, document.body, order.facts),
      })
      if (kept.created) {
        undo.copies.push(kept.id)
      }
    }
    if (documents.length < accepted.length) {
      // A version accepted is never deleted: published texts stay as history
      logger.error({ event: "legal.accepted_version_missing", orderId: input.order_id })
    }
    // Last: a consent still waiting for its order is what the sweep finds
    if (!consent.order_id) {
      await service.updateLegalConsents({ id: consent.id, order_id: input.order_id })
      undo.consent_id = consent.id
    }
    return new StepResponse({ kept: undo.copies.length }, undo)
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const service = container.resolve<LegalModuleService>(LEGAL_MODULE)
    if (undo.copies.length > 0) {
      await service.deleteLegalOrderCopies(undo.copies)
    }
    if (undo.consent_id) {
      await service.updateLegalConsents({ id: undo.consent_id, order_id: null })
    }
  }
)

/** F13.2: the order's contracts, kept once it is placed. */
export const keepOrderContractsWorkflow = createWorkflow(
  "legal-keep-order-contracts",
  (input: { order_id: string }) => new WorkflowResponse(keepOrderContractsStep(input))
)

const SWEEP_DAYS = 7
const PAGE = 200

/**
 * The orders whose contracts the event did not keep (a failure, a restart
 * between). Read from the orders of the last week, which nobody can flood,
 * not from the consents: an order whose cart's consent still waits for it.
 * One order failing is logged and the rest go on.
 */
export async function keepMissedOrderContracts(container: MedusaContainer): Promise<number> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const service = container.resolve<LegalModuleService>(LEGAL_MODULE)
  const since = new Date(Date.now() - SWEEP_DAYS * 86_400_000)
  let kept = 0
  for (let skip = 0; ; skip += PAGE) {
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "cart.id"],
      filters: { created_at: { $gte: since } },
      pagination: { skip, take: PAGE, order: { created_at: "ASC" } },
    })
    const orders = data as { id: string; cart?: { id: string } | null }[]
    const byCart = new Map(
      orders.flatMap((order) => (order.cart?.id ? [[order.cart.id, order.id] as const] : []))
    )
    const waiting = byCart.size
      ? await service.listLegalConsents(
          { order_id: null, cart_id: [...byCart.keys()] },
          { select: ["cart_id"] }
        )
      : []
    for (const consent of waiting) {
      const orderId = byCart.get(consent.cart_id)
      if (!orderId) {
        continue
      }
      try {
        await keepOrderContractsWorkflow(container).run({ input: { order_id: orderId } })
        kept += 1
      } catch (error) {
        logger.error({
          event: "legal.order_contracts_sweep_order_failed",
          orderId,
          err: errorSummary(error),
        })
      }
    }
    if (orders.length < PAGE) {
      return kept
    }
  }
}
