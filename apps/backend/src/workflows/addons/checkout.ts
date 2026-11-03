import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { updateLineItemInCartWorkflow } from "@medusajs/medusa/core-flows"
import { ADDONS_KEY, lineAddonsOf } from "../../lib/catalog/addons"
import { ConflictError, ValidationError } from "../../lib/errors"
import { toMedusaAmount } from "../../lib/money"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { PRODUCT_ADDONS } from "../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { clearablePrice, linesOf, readAddonCart } from "./cart"
import type { AddonCart } from "./cart"
import { reviewAddonLines } from "./price-line"
import type { AddonReview } from "./price-line"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The cart's add-on lines checked before it is paid for: with the shop's
 * add-ons off, a line carrying them stops the checkout; a pick that no
 * longer sells (or a required add-on missing) is refused. Null with the
 * shop's add-ons off and none in the cart: nothing to review.
 */
async function review(container: Container, cart: AddonCart): Promise<AddonReview | null> {
  const enabled = await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .isFeatureEnabled(PRODUCT_ADDONS)
  if (!enabled) {
    if (linesOf(cart).some((line) => lineAddonsOf(line.metadata))) {
      throw new ValidationError("catalog.addons_disabled", { field: "items" })
    }
    return null
  }
  const found = await reviewAddonLines(container, cart)
  if (found.problem) {
    throw new ValidationError(found.problem.key, { field: found.problem.field })
  }
  return found
}

/**
 * At the order's completion (adr/0052 §5): every add-on line still costs
 * what it did. A price that moved since the payment started stops the
 * order (409 `cart.prices_changed`); the storefront shows the cart again
 * and the payment starts anew, which puts the lines right. Reads only:
 * the completion holds the cart's lock.
 */
export async function assertAddonLinesCurrent(container: Container, cartId: string) {
  const cart = await readAddonCart(container, cartId)
  if (!cart) {
    return
  }
  const found = await review(container, cart)
  if (found && found.stale.length > 0) {
    throw new ConflictError("cart.prices_changed")
  }
}

export interface RepriceAddonLinesInput {
  cart_id: string
  sales_channel_ids: string[]
}

/**
 * Before a payment starts (adr/0052 §5): an add-on line whose price moved
 * is put at its price now, through Medusa's own line update (it takes the
 * cart's lock, so this runs before the start takes it), and the start
 * stops with 409 `cart.prices_changed`: the shopper sees the new total
 * before paying it. The new price stays when the start stops: it is the
 * right one.
 */
export const repriceAddonLinesStep = createStep(
  "addons-reprice-lines",
  async (input: RepriceAddonLinesInput, { container }) => {
    const cart = await readAddonCart(container, input.cart_id)
    if (!cart || !input.sales_channel_ids.includes(cart.sales_channel_id ?? "")) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "cart.unknown")
    }
    if (cart.completed_at) {
      throw new ConflictError("cart.completed")
    }
    const found = await review(container, cart)
    if (!found || found.stale.length === 0) {
      return new StepResponse({ repriced: 0 })
    }
    const lines = new Map(linesOf(cart).map((line) => [line.id, line]))
    for (const priced of found.stale) {
      const others = Object.fromEntries(
        Object.entries(lines.get(priced.line_id)?.metadata ?? {}).filter(
          ([key]) => key !== ADDONS_KEY
        )
      )
      await updateLineItemInCartWorkflow(container).run({
        input: {
          cart_id: cart.id,
          item_id: priced.line_id,
          update: {
            quantity: priced.quantity,
            unit_price: toMedusaAmount(priced.unit_price),
            compare_at_unit_price: clearablePrice(
              priced.compare_at_unit_price === null
                ? null
                : toMedusaAmount(priced.compare_at_unit_price)
            ),
            metadata: { ...others, [ADDONS_KEY]: priced.addons },
          },
        },
      })
    }
    throw new ConflictError("cart.prices_changed")
  }
)
