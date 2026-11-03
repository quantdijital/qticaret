import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { fromMedusaAmount } from "../../lib/money"
import type { MedusaAmount } from "../../lib/money"
import { cartDifference, completesNow, isOpen } from "../../lib/payment-links/snapshot"
import { isFeeLine } from "../../lib/payments/cod"
import { enteredCodes } from "../../lib/promotions"
import { PAYMENT_LINKS_MODULE } from "../../modules/payment-links"
import type PaymentLinksModuleService from "../../modules/payment-links/service"
import { alertLink } from "./alerts"
import { paymentLinkSettings } from "./settings"
import { linesOf } from "./views"

type Container = Pick<MedusaContainer, "resolve">

/** The cart's metadata key naming the link it was opened from; the server's alone (`qt_`). */
export const CART_LINK_KEY = "qt_payment_link"

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
    ],
    filters: { id: cartId },
  })
  return data[0]
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
 *   hour past its end for a payment under way), this cart its latest,
 *   its lines and code as the link made them, at the link's prices.
 * Null for an ordinary cart that carries no link's code.
 */
export async function linkCartProblem(
  container: Container,
  cartId: string,
  at: "start" | "complete",
  now = new Date()
): Promise<LinkCartProblem | null> {
  const cart = await cartRow(container, cartId)
  if (!cart) {
    return null
  }
  const linkId = linkIdOfCart(cart.metadata)
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

/** Stops the order of a cart a link's rules refuse (the completion hook, adr/0051 §5). */
export async function assertLinkCartCompletes(container: Container, cartId: string): Promise<void> {
  const problem = await linkCartProblem(container, cartId, "complete")
  if (problem) {
    throw new ValidationError(problem)
  }
}
