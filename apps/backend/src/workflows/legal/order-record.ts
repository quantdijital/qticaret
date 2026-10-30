import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { LEGAL_MODULE } from "../../modules/legal"
import type LegalModuleService from "../../modules/legal/service"
import type { AcceptedDocument } from "../../modules/legal/service"

/**
 * The contracts an order was placed with (F13.2): when and from which
 * address the shopper accepted them, which versions, and the copies
 * kept. Null when the order carries no consent (placed before the shop
 * published its contracts).
 */
export async function orderLegalRecord(
  container: Pick<MedusaContainer, "resolve">,
  orderId: string
) {
  const service = container.resolve<LegalModuleService>(LEGAL_MODULE)
  const [[consent], copies] = await Promise.all([
    service.listLegalConsents({ order_id: orderId }, { take: 1 }),
    service.listLegalOrderCopies(
      { order_id: orderId },
      { select: ["kind", "version", "title", "html_hash", "created_at"] }
    ),
  ])
  if (!consent) {
    return null
  }
  return {
    given_at: new Date(consent.given_at).toISOString(),
    ip: service.ipOf(consent),
    documents: (consent.documents as unknown as AcceptedDocument[]).map(({ kind, version }) => ({
      kind,
      version,
    })),
    copies: copies.map((copy) => ({
      kind: copy.kind,
      version: copy.version,
      title: copy.title,
      html_hash: copy.html_hash,
      created_at: new Date(copy.created_at).toISOString(),
    })),
  }
}

/**
 * The age the buyer declared for the order's cart (F13.3): the shop's limit
 * then, and when; never the date of birth. Null when none was asked.
 */
export async function orderAgeDeclaration(
  container: Pick<MedusaContainer, "resolve">,
  orderId: string
) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["cart.id"],
    filters: { id: orderId },
  })
  const cartId = (data[0] as { cart?: { id: string } | null } | undefined)?.cart?.id
  if (!cartId) {
    return null
  }
  const [declaration] = await container
    .resolve<LegalModuleService>(LEGAL_MODULE)
    .listAgeDeclarations({ cart_id: cartId }, { take: 1, select: ["min_age", "declared_at"] })
  return declaration
    ? {
        min_age: declaration.min_age,
        declared_at: new Date(declaration.declared_at).toISOString(),
      }
    : null
}
