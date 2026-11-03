import type {
  ICartModuleService,
  IOrderModuleService,
  MedusaContainer,
} from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { lineAddonsOf } from "../../lib/catalog/addons"
import { giftRecipientOf, issuedCardsOf, withoutRecipient } from "../../lib/promotions/gift-sale"

type Container = Pick<MedusaContainer, "resolve">

/**
 * A gift line's recipient is a third person the buyer named (adr/0025 Ek
 * 2026-11-03, docs/kvkk-envanter.md): kept with the order, shown in the
 * buyer's copy of their data, erased with their orders. The cards the line
 * issued stay (id and last four characters): they are the books'.
 */

type ItemRow = { id: string; metadata?: Record<string, unknown> | null } | null

/**
 * An order's lines in the buyer's copy: what they gave for a gift and
 * their add-on picks, not the line's other notes.
 */
export function exportedItems(items: unknown): unknown {
  if (!Array.isArray(items)) {
    return items
  }
  return (items as (Record<string, unknown> | null)[]).map((item) => {
    if (!item) {
      return item
    }
    const { metadata, ...rest } = item
    const recipient = giftRecipientOf(metadata)
    const cards = issuedCardsOf(metadata)
    // The add-ons they picked, the text they typed with them (adr/0052 §10)
    const addons = lineAddonsOf(metadata)?.items ?? []
    return {
      ...rest,
      ...(recipient || cards.length > 0
        ? {
            hediye: {
              alıcı_e_posta: recipient?.recipient_email ?? null,
              alıcı_adı: recipient?.recipient_name ?? null,
              mesaj: recipient?.message ?? null,
              gönderen_adı: recipient?.sender_name ?? null,
              kartlar: cards.map((card) => `…${card.last4}`),
            },
          }
        : {}),
      ...(addons.length > 0
        ? {
            ek_seçenekler: addons.map((addon) => ({
              ad: addon.label,
              değer: addon.value ?? addon.choice_label ?? null,
            })),
          }
        : {}),
    }
  })
}

/** The recipients these orders' gift lines name, and their carts' lines, erased. */
export async function eraseGiftRecipients(
  container: Container,
  orderIds: readonly string[]
): Promise<number> {
  if (orderIds.length === 0) {
    return 0
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "items.id", "items.metadata", "cart.id"],
    filters: { id: [...orderIds] },
  })
  const rows = data as { items?: ItemRow[] | null; cart?: { id?: string } | null }[]
  const orders = container.resolve<IOrderModuleService>(Modules.ORDER)
  let erased = 0
  for (const item of rows.flatMap((row) => row.items ?? [])) {
    const metadata = item ? withoutRecipient(item.metadata) : null
    if (item && metadata) {
      await orders.updateOrderLineItems(item.id, { metadata })
      erased += 1
    }
  }
  const cartIds = rows.flatMap((row) => (row.cart?.id ? [row.cart.id] : []))
  if (cartIds.length > 0) {
    const carts = container.resolve<ICartModuleService>(Modules.CART)
    const lines = await carts.listLineItems(
      { cart_id: cartIds },
      { select: ["id", "metadata"], take: null }
    )
    for (const line of lines) {
      const metadata = withoutRecipient(line.metadata)
      if (metadata) {
        await carts.updateLineItems(line.id, { metadata })
      }
    }
  }
  return erased
}
