import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { RetryableError, ValidationError } from "../../lib/errors"
import { logger } from "../../lib/logging"
import { fromMedusaAmount } from "../../lib/money"
import type { MedusaAmount } from "../../lib/money"
import { cartDifference, completesNow, heldByOther, isOpen } from "../../lib/payment-links/snapshot"
import { isFeeLine } from "../../lib/payments/cod"
import { enteredCodes } from "../../lib/promotions"
import { PAYMENT_LINKS_MODULE } from "../../modules/payment-links"
import type PaymentLinksModuleService from "../../modules/payment-links/service"
import { alertLink } from "./alerts"
import { CART_LINK_KEY, completedLinkCarts } from "./link-carts"
import { paymentLinkSettings } from "./settings"
import { linesOf } from "./views"

type Container = Pick<MedusaContainer, "resolve">

export { CART_LINK_KEY }

interface CartRow {
  id: string
  metadata?: Record<string, unknown> | null
  currency_code?: string | null
  items?:
    | ({
        variant_id?: string | null
        quantity: MedusaAmount
        unit_price: MedusaAmount
        is_custom_price?: boolean | null
        metadata?: Record<string, unknown> | null
      } | null)[]
    | null
  promotions?: ({ code?: string | null; is_automatic?: boolean | null } | null)[] | null
  order?: { id: string } | null
}

export type LinkCartProblem =
  | "cart.payment_link_closed"
  | "cart.payment_link_superseded"
  | "cart.payment_link_changed"
  | "cart.payment_link_prices_changed"
  | "cart.payment_link_code_misused"

/** The link a cart was opened from, by its metadata; null for an ordinary cart. */
export const linkIdOfCart = (metadata: unknown): string | null => {
  const id = (metadata as Record<string, unknown> | null | undefined)?.[CART_LINK_KEY]
  return typeof id === "string" && id !== "" ? id : null
}

async function cartRow(container: Container, cartId: string): Promise<CartRow | undefined> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: [
      "id",
      "metadata",
      "currency_code",
      "items.variant_id",
      "items.quantity",
      "items.unit_price",
      "items.is_custom_price",
      "items.metadata",
      "promotions.code",
      "promotions.is_automatic",
      "order.id",
    ],
    filters: { id: cartId },
  })
  return data[0] as CartRow | undefined
}

/** Marks an open link's prices as moved and tells staff, once. */
export async function markPricesChanged(container: Container, linkId: string): Promise<void> {
  const links = container.resolve<PaymentLinksModuleService>(PAYMENT_LINKS_MODULE)
  const [link] = await links.listPaymentLinks({ id: linkId, status: "open" }, { take: 1 })
  if (link) {
    await links.updatePaymentLinks({ id: link.id, status: "draft" })
    await alertLink(container, "prices_changed", link)
  }
}

/**
 * Whether the cart may start its payment (`at: "start"`) or become its
 * order (`at: "complete"`) as far as payment links go (adr/0051 §4, §5):
 * - a link's code only on the cart opened from that link;
 * - a cart opened from a link: the link still open (at completion, an
 *   hour past its end for a payment under way), this cart its latest, no
 *   other cart of the link an order, its lines and code as the link made
 *   them, at the link's prices.
 * Null for an ordinary cart that carries no link's code.
 */
export async function linkCartProblem(
  container: Container,
  cartId: string,
  at: "start" | "complete",
  now = new Date()
): Promise<LinkCartProblem | null> {
  return (await linkCartCheck(container, cartId, at, now)).problem
}

/** `linkCartProblem`, with the link the cart was opened from (null for an ordinary cart). */
async function linkCartCheck(
  container: Container,
  cartId: string,
  at: "start" | "complete",
  now: Date
): Promise<{ problem: LinkCartProblem | null; link_id: string | null }> {
  const cart = await cartRow(container, cartId)
  // Completing a cart already an order answers with that order: nothing to judge, no hold
  if (at === "complete" && cart?.order?.id) {
    return { problem: null, link_id: null }
  }
  const linkId = cart ? linkIdOfCart(cart.metadata) : null
  return {
    problem: cart ? await cartProblem(container, cart, linkId, at, now) : null,
    link_id: linkId,
  }
}

async function cartProblem(
  container: Container,
  cart: CartRow,
  linkId: string | null,
  at: "start" | "complete",
  now: Date
): Promise<LinkCartProblem | null> {
  const codes = enteredCodes(cart.promotions)
  const links = container.resolve<PaymentLinksModuleService>(PAYMENT_LINKS_MODULE)
  if (codes.length > 0) {
    const owners = await links.listPaymentLinks(
      { promotion_code: codes },
      { select: ["id"], take: codes.length }
    )
    if (owners.some((owner) => owner.id !== linkId)) {
      return "cart.payment_link_code_misused"
    }
  }
  if (!linkId) {
    return null
  }
  const [link] = await links.listPaymentLinks({ id: linkId }, { take: 1 })
  if (!link || !(at === "start" ? isOpen(link, now) : completesNow(link, now))) {
    return "cart.payment_link_closed"
  }
  if (link.cart_id !== cart.id) {
    return "cart.payment_link_superseded"
  }
  // Another cart's completion holds the link: no payment starts for this one meanwhile
  if (at === "start" && heldByOther(link, cart.id, now)) {
    return "cart.payment_link_closed"
  }
  // Another cart of this link already became an order (its paid mark not run yet, or
  // lost): this one is never paid too
  const placed = await completedLinkCarts(container, { link_id: link.id }, 10)
  if (placed.some((other) => other.cart_id !== cart.id)) {
    return "cart.payment_link_closed"
  }
  const expectedCodes = link.promotion_code ? [link.promotion_code] : []
  if (
    codes.length !== expectedCodes.length ||
    codes.some((code) => !expectedCodes.includes(code))
  ) {
    return "cart.payment_link_changed"
  }
  if ((cart.currency_code ?? "").toLowerCase() !== link.currency_code) {
    return "cart.payment_link_changed"
  }
  const difference = cartDifference(
    linesOf(link),
    // The fee of paying at the door is the server's line, when the owner allows it
    (cart.items ?? []).flatMap((item) =>
      item && !isFeeLine(item)
        ? [
            {
              variant_id: item.variant_id ?? null,
              quantity: Number(item.quantity),
              unit_price: fromMedusaAmount(item.unit_price, { allowRounding: true }),
            },
          ]
        : []
    )
  )
  if (difference === "prices") {
    await markPricesChanged(container, link.id)
    return "cart.payment_link_prices_changed"
  }
  return difference === "changed" ? "cart.payment_link_changed" : null
}

/**
 * Whether a cart may be paid at the door as far as payment links go, by
 * its metadata: a link's cart only when the owner allows it
 * (`payment_links.allow_cod`, adr/0051 soru 4). Null for an ordinary cart,
 * and for a link's cart then; cash on delivery's own rules (flag, limit,
 * courier) still apply.
 */
export async function linkCodProblem(
  container: Container,
  cartMetadata: unknown
): Promise<"cart.payment_link_no_cod" | null> {
  if (linkIdOfCart(cartMetadata) === null || (await paymentLinkSettings(container)).allow_cod) {
    return null
  }
  return "cart.payment_link_no_cod"
}

/**
 * Stops the order of a cart a link's rules refuse (the completion hook,
 * adr/0051 §5). The link the cart was opened from, for its hold
 * (`claimLinkForCart`); null for an ordinary cart.
 */
export async function assertLinkCartCompletes(
  container: Container,
  cartId: string
): Promise<string | null> {
  const { problem, link_id } = await linkCartCheck(container, cartId, "complete", new Date())
  if (problem) {
    throw new ValidationError(problem)
  }
  return link_id
}

/** A completion's hold on its link, for the hook's compensation to let go of. */
export interface LinkClaim {
  link_id: string
  cart_id: string
  /** This completion run's own mark: only it lets go of the hold. */
  token: string
}

/**
 * The link held for this cart while it becomes its order (adr/0051 §5),
 * the completion hook's last act: the checks above read the link, but two
 * carts completing at once can both pass them. The one that holds it goes
 * on, before its order or its payment's authorization. The other stops
 * there: while the holder's completion is under way (it may yet fail) the
 * cart is tried again (a card's notice is retried, its money kept); a cart
 * that may not become the link's order is refused as for a closed link, so
 * a card already charged for it is refunded as a payment without an order
 * (adr/0026 §6).
 */
export async function claimLinkForCart(
  container: Container,
  linkId: string,
  cartId: string
): Promise<LinkClaim> {
  const token = randomUUID()
  const outcome = await container
    .resolve<PaymentLinksModuleService>(PAYMENT_LINKS_MODULE)
    .claimForCart(linkId, cartId, token)
  if (outcome === "busy") {
    logger.info({ event: "payment_links.claim_busy", linkId, cartId })
    throw new RetryableError()
  }
  if (outcome === "refused") {
    logger.warn({ event: "payment_links.claim_refused", linkId, cartId })
    throw new ValidationError("cart.payment_link_closed")
  }
  return { link_id: linkId, cart_id: cartId, token }
}

/** Lets go of the hold when the completion that took it failed after the hook. */
export async function releaseLinkClaim(
  container: Container,
  claim: LinkClaim | null | undefined
): Promise<void> {
  // Null (an ordinary cart), or the hook's answer where Medusa passes that instead
  if (!claim?.link_id || !claim.token) {
    return
  }
  await container
    .resolve<PaymentLinksModuleService>(PAYMENT_LINKS_MODULE)
    .releaseClaim(claim.link_id, claim.token)
}
