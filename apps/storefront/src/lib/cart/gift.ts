import "server-only"
import { isStoreApiError } from "../store-api/errors"
import { storefrontSettings } from "../store-api/requests"
import { storeDelete, storeGet, storePost } from "../store-api/server"
import { addLine, currentCart } from "./cart"
import { cartIdFromCookie } from "./cookie"

/**
 * Gift card lines (adr/0025 Ek 2026-11-03): the shop sells a card as a
 * product whose variants are its amounts; the line names who the card is
 * e-mailed to. Only the recipient's words are sent; the amount is the
 * variant's price, the backend's (CLAUDE.md rule 5).
 */

/** What the backend keeps of a recipient (`metadata.qt_gift`). */
export interface GiftRecipient {
  recipient_email: string
  recipient_name: string | null
  message: string | null
  sender_name: string | null
}

export interface GiftLine {
  line_id: string
  product_id: string | null
  variant_id: string | null
  /** Null: not named yet; the payment waits for it. */
  recipient: GiftRecipient | null
}

/** Whether the shop sells gift cards now (`/store/storefront` `features`). */
export async function giftCardsOn(): Promise<boolean> {
  const { features } = await storefrontSettings()
  return features?.gift_cards === true
}

/** The cart's gift lines; none while the shop sells no cards (the route answers 404 then). */
export async function giftLinesOf(cartId: string): Promise<GiftLine[]> {
  try {
    const { gift_lines } = await storeGet<{ gift_lines: GiftLine[] }>(
      `/store/carts/${encodeURIComponent(cartId)}/gift-lines`
    )
    return gift_lines
  } catch (error) {
    if (isStoreApiError(error) && error.status === 404) {
      return []
    }
    throw error
  }
}

/** The gift lines of the shopper's cart while the shop sells cards; none on any failure to read them. */
export async function shopperGiftLines(cartId: string | null | undefined): Promise<GiftLine[]> {
  if (!cartId || !(await giftCardsOn())) {
    return []
  }
  return giftLinesOf(cartId).catch((error: unknown) => {
    if (isStoreApiError(error)) {
      return []
    }
    throw error
  })
}

export type GiftInput = Pick<GiftRecipient, "recipient_email"> &
  Partial<Omit<GiftRecipient, "recipient_email">>

const giftPath = (cartId: string, lineId: string) =>
  `/store/carts/${encodeURIComponent(cartId)}/line-items/${encodeURIComponent(lineId)}/gift`

/**
 * A gift card into the cart with its recipient. Medusa may add the
 * amount to a line of the same card that names no one yet; the line found
 * is the new one, else that one. A refused recipient takes the line back
 * as it was (a new one removed, a grown one shrunk): the form shows the
 * refusal and sending it again adds no second line.
 */
export async function addGiftLine(
  variantId: string,
  quantity: number,
  recipient: GiftInput
): Promise<void> {
  const before = await currentCart().catch((error: unknown) => {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  })
  const known = new Map((before?.items ?? []).map((line) => [line.id, line.quantity]))
  const cartId = await addLine(variantId, quantity)
  const lines = (await giftLinesOf(cartId)).filter((line) => line.variant_id === variantId)
  const fresh = lines.find((line) => !known.has(line.line_id))
  const line = fresh ?? lines.find((line) => line.recipient === null)
  if (!line) {
    throw new Error("gift: the card's line was not found in the cart")
  }
  try {
    await storePost(giftPath(cartId, line.line_id), recipient)
  } catch (error) {
    const path = `/store/carts/${encodeURIComponent(cartId)}/line-items/${encodeURIComponent(line.line_id)}`
    const undo = fresh
      ? storeDelete(path)
      : storePost(path, { quantity: known.get(line.line_id) ?? quantity })
    await undo.catch(() => undefined)
    throw error
  }
}

/** A gift line's recipient, written again (from the cart). */
export async function saveGiftLine(lineId: string, recipient: GiftInput): Promise<void> {
  const cartId = await cartIdFromCookie()
  if (!cartId) {
    throw new Error("gift: no cart")
  }
  await storePost(giftPath(cartId, lineId), recipient)
}
