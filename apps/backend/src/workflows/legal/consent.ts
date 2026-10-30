import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { ConflictError, ValidationError } from "../../lib/errors"
import { ORDER_KINDS } from "../../lib/legal"
import type { LegalKind } from "../../lib/legal"
import { LEGAL_MODULE } from "../../modules/legal"
import type LegalModuleService from "../../modules/legal/service"
import type { AcceptedDocument } from "../../modules/legal/service"

type Container = Pick<MedusaContainer, "resolve">

const legal = (container: Container) => container.resolve<LegalModuleService>(LEGAL_MODULE)

/**
 * The contracts a checkout needs accepted (adr/0041 §2): the published
 * versions of those made with an order. None while the shop has published
 * none; the setup checklist asks for them meanwhile.
 */
export async function requiredContracts(container: Container) {
  return legal(container).listLegalDocuments(
    { kind: [...ORDER_KINDS], status: "published" },
    { select: ["id", "kind", "version", "body_hash"], order: { kind: "ASC" } }
  )
}

const acceptedOf = (documents: unknown): AcceptedDocument[] =>
  Array.isArray(documents) ? (documents as AcceptedDocument[]) : []

/**
 * Why the cart cannot be paid for or completed yet, or null: no consent to
 * the contracts, or a contract published again since it was accepted.
 */
export async function consentProblem(container: Container, cartId: string) {
  const required = await requiredContracts(container)
  if (required.length === 0) {
    return null
  }
  const [consent] = await legal(container).listLegalConsents(
    { cart_id: cartId },
    { take: 1, select: ["documents"] }
  )
  if (!consent) {
    return "legal.consent_missing"
  }
  const accepted = acceptedOf(consent.documents)
  const current = required.every((document) =>
    accepted.some((each) => each.document_id === document.id)
  )
  return current ? null : "legal.version_changed"
}

/** Stops a payment or a checkout whose contracts were not accepted as they stand now. */
export async function assertConsented(container: Container, cartId: string): Promise<void> {
  const problem = await consentProblem(container, cartId)
  if (problem) {
    throw new ValidationError(problem, { field: "legal_consents" })
  }
}

export interface RecordConsentInput {
  cart_id: string
  sales_channel_ids: string[]
  documents: { kind: LegalKind; version: number }[]
  /** Sealed by the route: the plain address never reaches the workflow engine. */
  ip_encrypted: string | null
}

interface Previous {
  id: string
  documents: unknown
  ip_encrypted: string | null
  given_at: Date
}

/**
 * Records what the shopper accepted, the versions the storefront showed:
 * exactly the contracts published now, or the storefront shows them again.
 * Undone, the cart's earlier answer comes back.
 */
const recordConsentStep = createStep(
  "legal-record-consent",
  async (input: RecordConsentInput, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "cart",
      fields: ["id", "completed_at", "sales_channel_id"],
      filters: { id: input.cart_id },
    })
    const cart = data[0] as { completed_at: unknown; sales_channel_id: string | null } | undefined
    if (
      !cart ||
      cart.completed_at ||
      !input.sales_channel_ids.includes(cart.sales_channel_id ?? "")
    ) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "carts.unknown")
    }
    const required = await requiredContracts(container)
    if (required.length === 0) {
      throw new ValidationError("legal.nothing_to_accept")
    }
    const sent = new Map(input.documents.map((each) => [each.kind, each.version]))
    const matches =
      sent.size === input.documents.length &&
      sent.size === required.length &&
      required.every((document) => sent.get(document.kind) === document.version)
    if (!matches) {
      throw new ConflictError("legal.version_changed")
    }
    const service = legal(container)
    const [before] = await service.listLegalConsents(
      { cart_id: input.cart_id },
      { take: 1, select: ["id", "documents", "ip_encrypted", "given_at"] }
    )
    const consent = await service.recordConsent(
      input.cart_id,
      required.map((document) => ({
        kind: document.kind,
        version: document.version,
        document_id: document.id,
        body_hash: document.body_hash ?? null,
      })),
      input.ip_encrypted
    )
    return new StepResponse(
      {
        given_at: new Date(consent.given_at).toISOString(),
        documents: required.map(({ kind, version }) => ({ kind, version })),
      },
      { id: consent.id, before: (before as Previous | undefined) ?? null }
    )
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const service = legal(container)
    if (undo.before) {
      await service.updateLegalConsents({
        id: undo.id,
        documents: undo.before.documents as Record<string, unknown>,
        ip_encrypted: undo.before.ip_encrypted,
        given_at: undo.before.given_at,
      })
    } else {
      await service.deleteLegalConsents([undo.id])
    }
  }
)

/** adr/0041 §2: the shopper accepts the contracts before paying. */
export const recordLegalConsentWorkflow = createWorkflow(
  "legal-record-consent",
  (input: RecordConsentInput) => new WorkflowResponse(recordConsentStep(input))
)
