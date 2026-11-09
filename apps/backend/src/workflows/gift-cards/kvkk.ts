import type { MedusaContainer } from "@medusajs/framework/types"
import { lineAddonsOf } from "../../lib/catalog/addons"
import { giftRecipientOf, issuedCardsOf, withoutRecipient } from "../../lib/promotions/gift-sale"
import { rewriteOrderLines } from "../legal/erasure/order-lines"

type Container = Pick<MedusaContainer, "resolve">

/**
 * A gift line's recipient is a third person the buyer named (adr/0025 Ek
 * 2026-11-03, docs/kvkk-envanter.md): kept with the order, shown in the
 * buyer's copy of their data, erased with their orders. The cards the line
 * issued stay (id and last four characters): they are the books'.
 */

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

/**
 * The recipients these orders' gift lines name erased in every copy the
 * order keeps: the line item, each order version's item and the cart's line.
 */
export const eraseGiftRecipients = (container: Container, orderIds: readonly string[]) =>
  rewriteOrderLines(container, orderIds, withoutRecipient)
