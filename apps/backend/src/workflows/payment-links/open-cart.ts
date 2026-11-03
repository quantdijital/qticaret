import type { CreateCartWorkflowInputDTO, MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  addShippingMethodToCartWorkflow,
  createCartWorkflow,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { ConflictError } from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import { isOpen, movedPrices } from "../../lib/payment-links/snapshot"
import { PAYMENT_LINKS_MODULE } from "../../modules/payment-links"
import type PaymentLinksModuleService from "../../modules/payment-links/service"
import type { PaymentLinkAddress } from "../../modules/payment-links/service"
import { alertLink } from "./alerts"
import { CART_LINK_KEY, linkCartProblem, markPricesChanged } from "./cart-guard"
import { linkLockKey } from "./manage"
import { currentPrices, liraRegion, shortLines } from "./pricing"
import { linesOf } from "./views"

type Container = Pick<MedusaContainer, "resolve">

export interface OpenLinkCartInput {
  link_id: string
  sales_channel_id: string
}

const service = (container: Container) =>
  container.resolve<PaymentLinksModuleService>(PAYMENT_LINKS_MODULE)

/** A preset address as a cart takes it: empty fields left out. */
const cartAddress = (address: PaymentLinkAddress) =>
  Object.fromEntries(
    Object.entries(address).filter(([, value]) => value !== null && value !== "")
  ) as Record<string, string>

/**
 * The cart a link opens, before it is made (adr/0051 §3): the link open,
 * its lines on the shelf, and the catalog's prices still the link's. A
 * price that moved turns the link to `draft` and tells staff (409); so
 * does a short line (409, staff told). Everything else: the cart's input.
 */
const prepareCartStep = createStep(
  "payment-links-prepare-cart",
  async (input: OpenLinkCartInput, { container }) => {
    const links = service(container)
    const [link] = await links.listPaymentLinks({ id: input.link_id }, { take: 1 })
    const live = link && new Date(link.expires_at).getTime() > Date.now()
    if (!link || !live || (link.status !== "open" && link.status !== "draft")) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "payment_link.unavailable")
    }
    if (!isOpen(link)) {
      throw new ConflictError("payment_link.prices_changed")
    }
    const lines = linesOf(link)
    const short = await shortLines(container, lines, input.sales_channel_id)
    if (short.size > 0) {
      await alertLink(container, "out_of_stock", link)
      throw new ConflictError("payment_link.out_of_stock")
    }
    const region = await liraRegion(container)
    const prices = await currentPrices(container, lines, {
      region_id: region,
      customer_id: link.customer_id,
    })
    if (movedPrices(lines, prices).length > 0) {
      await markPricesChanged(container, link.id)
      throw new ConflictError("payment_link.prices_changed")
    }
    const sealed = links.openPrivate(link.sealed)
    const address = sealed?.address ?? null
    const cart: CreateCartWorkflowInputDTO = {
      region_id: region,
      sales_channel_id: input.sales_channel_id,
      currency_code: "try",
      ...(sealed?.contact.email ? { email: sealed.contact.email } : {}),
      ...(link.customer_id ? { customer_id: link.customer_id } : {}),
      items: lines.map((line) => ({ variant_id: line.variant_id, quantity: line.quantity })),
      ...(link.promotion_code ? { promo_codes: [link.promotion_code] } : {}),
      ...(address
        ? { shipping_address: cartAddress(address), billing_address: cartAddress(address) }
        : {}),
      metadata: { [CART_LINK_KEY]: link.id },
    }
    return new StepResponse({
      cart,
      shipping_option_id: address ? link.shipping_option_id : null,
    })
  }
)

/**
 * The new cart as the link made it, once the link names it: its lines at
 * the link's prices (Medusa priced them as it prices any cart) and its
 * code. A difference is a price that moved between the check and the
 * cart: the link goes to `draft` (staff told), and the cart and the
 * binding are taken back with the workflow.
 */
const checkCartStep = createStep(
  "payment-links-check-cart",
  async (input: { cart_id: string }, { container }) => {
    const problem = await linkCartProblem(container, input.cart_id, "start")
    if (problem === "cart.payment_link_prices_changed") {
      throw new ConflictError("payment_link.prices_changed")
    }
    if (problem) {
      throw new ConflictError("payment_link.unavailable")
    }
    return new StepResponse(null)
  }
)

/** A preset shipping option, best effort: the checkout asks for one when it cannot be set. */
const presetShippingStep = createStep(
  "payment-links-preset-shipping",
  async (input: { cart_id: string; option_id: string | null }, { container }) => {
    if (!input.option_id) {
      return new StepResponse(null)
    }
    const { errors } = await addShippingMethodToCartWorkflow(container).run({
      input: { cart_id: input.cart_id, options: [{ id: input.option_id }] },
      throwOnError: false,
    })
    if (errors[0]) {
      logger.warn({
        event: "payment_links.shipping_not_preset",
        cartId: input.cart_id,
        err: errorSummary(errors[0].error),
      })
    }
    return new StepResponse(null)
  }
)

/**
 * The link names this cart as its own: an earlier one opened from it no
 * longer completes (a card charged for that one is refunded as a payment
 * without an order, adr/0026 §6). Undone, the earlier cart and counts return.
 */
const bindCartStep = createStep(
  "payment-links-bind-cart",
  async (input: { link_id: string; cart_id: string }, { container }) => {
    const links = service(container)
    const [link] = await links.listPaymentLinks({ id: input.link_id }, { take: 1 })
    if (!link) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "payment_link.unavailable")
    }
    await links.updatePaymentLinks({
      id: link.id,
      cart_id: input.cart_id,
      opened_count: link.opened_count + 1,
      last_opened_at: new Date(),
    })
    return new StepResponse(
      { cart_id: input.cart_id },
      {
        id: link.id,
        cart_id: link.cart_id,
        opened_count: link.opened_count,
        last_opened_at: link.last_opened_at,
      }
    )
  },
  async (before, { container }) => {
    if (before) {
      await service(container).updatePaymentLinks(before)
    }
  }
)

/**
 * "Ödemeye geç" (adr/0051 §3): a fresh cart from the link, under the
 * link's lock, so two presses cannot cross. The storefront keeps the
 * cart's id and goes on to `/odeme`; the checkout runs as for any cart.
 */
export const openPaymentLinkCartWorkflow = createWorkflow(
  "payment-links-open-cart",
  (input: OpenLinkCartInput) => {
    const key = transform({ input }, ({ input }) => linkLockKey(input.link_id))
    acquireLockStep({ key, timeout: 5, ttl: 60 })
    const prepared = prepareCartStep(input)
    const cart = createCartWorkflow.runAsStep({
      input: transform({ prepared }, ({ prepared }) => prepared.cart),
    })
    const cartId = transform({ cart }, ({ cart }) => cart.id)
    const bound = bindCartStep({ link_id: input.link_id, cart_id: cartId })
    checkCartStep({ cart_id: cartId })
    presetShippingStep(
      transform({ cartId, prepared }, ({ cartId, prepared }) => ({
        cart_id: cartId,
        option_id: prepared.shipping_option_id,
      }))
    )
    releaseLockStep({ key })
    return new WorkflowResponse(bound)
  }
)
