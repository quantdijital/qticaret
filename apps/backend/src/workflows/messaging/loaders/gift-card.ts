import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { GiftCardVars } from "../../../lib/messaging/templates"
import type { MedusaAmount } from "../../../lib/money"
import { giftRecipientOf, giftTextProblem, issuedCardsOf } from "../../../lib/promotions/gift-sale"
import { brandOf } from "../brand"
import { lira } from "./order"
import { personName } from "./types"
import type { Loaded } from "./types"

interface OrderRow {
  id: string
  email?: string | null
  items?: ({ id: string; quantity?: number; metadata?: Record<string, unknown> | null } | null)[]
}

const shown = (text: string | null): string | null =>
  text !== null && giftTextProblem(text) === null ? text : null

/**
 * A sold gift line's e-mail (adr/0025 Ek 2026-11-03), read from the order:
 * its recipient (the buyer's own address when the line names none), and
 * the full codes of the cards the line recorded, read again from the
 * plugin. Null while the line has no card.
 */
export async function loadGiftCardMessage(
  container: Pick<MedusaContainer, "resolve">,
  orderId: string,
  extra: Readonly<Record<string, string>>
): Promise<Loaded<GiftCardVars> | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "email", "items.id", "items.metadata"],
    filters: { id: orderId },
  })
  const order = data[0] as OrderRow | undefined
  const line = (order?.items ?? []).find((item) => item?.id === extra["line_id"])
  const ids = issuedCardsOf(line?.metadata).map((card) => card.id)
  if (!order || !line || ids.length === 0) {
    return null
  }
  const { data: cards } = await query.graph({
    entity: "gift_card",
    fields: ["id", "code", "value"],
    filters: { id: ids },
  })
  const byId = new Map(
    (cards as { id: string; code: string; value: MedusaAmount }[]).map((card) => [card.id, card])
  )
  const recipient = giftRecipientOf(line.metadata)
  const { storefrontUrl } = await brandOf(container)
  return {
    vars: {
      recipientName: personName(recipient?.recipient_name),
      senderName: personName(recipient?.sender_name),
      message: shown(recipient?.message ?? null),
      cards: ids.flatMap((id) => {
        const card = byId.get(id)
        return card ? [{ code: card.code, value: lira(card.value) }] : []
      }),
      shopUrl: storefrontUrl,
    },
    recipients: { email: recipient?.recipient_email ?? order.email ?? null },
    receiverId: null,
    resourceType: "order",
  }
}
