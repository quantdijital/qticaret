import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { isLegalKind } from "../../lib/legal"
import { logger } from "../../lib/logging"
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

/**
 * The orders whose contracts the event did not keep (a failure, a restart
 * between): consents of the last week still waiting for their order, whose
 * cart became one.
 */
export async function keepMissedOrderContracts(container: MedusaContainer): Promise<number> {
  const service = container.resolve<LegalModuleService>(LEGAL_MODULE)
  const waiting = await service.listLegalConsents(
    { order_id: null, given_at: { $gte: new Date(Date.now() - SWEEP_DAYS * 86_400_000) } },
    { select: ["cart_id"], take: 500 }
  )
  if (waiting.length === 0) {
    return 0
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["id", "order.id"],
    filters: { id: waiting.map((each) => each.cart_id) },
  })
  let kept = 0
  for (const cart of data as { order?: { id: string } | null }[]) {
    if (cart.order?.id) {
      await keepOrderContractsWorkflow(container).run({ input: { order_id: cart.order.id } })
      kept += 1
    }
  }
  return kept
}
