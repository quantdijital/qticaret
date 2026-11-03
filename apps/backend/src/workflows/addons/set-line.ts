import type { ICartModuleService } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  refreshCartItemsWorkflow,
  releaseLockStep,
  updateLineItemInCartWorkflow,
} from "@medusajs/medusa/core-flows"
import { ADDONS_KEY } from "../../lib/catalog/addons"
import type { AddonSelection } from "../../lib/catalog/addons"
import { ValidationError } from "../../lib/errors"
import { toMedusaAmount } from "../../lib/money"
import { clearablePrice, linesOf, productAddonsAmong, readAddonCart } from "./cart"
import { priceAddonLine } from "./price-line"

export interface SetLineAddonsInput {
  cart_id: string
  line_id: string
  /** The publishable key's channels: a cart of another channel is not this storefront's. */
  sales_channel_ids: string[]
  selections: AddonSelection[]
}

type Metadata = Record<string, unknown>

/** What the line becomes: priced with its add-ons, or back to the variant's own price. */
export interface LinePlan {
  mode: "set" | "reset" | "none"
  line_id: string
  quantity: number
  unit_price: string | null
  compare_at_unit_price: string | null
  metadata: Metadata
  /** The line before, to put back if a later step fails (a reset). */
  before: { unit_price: unknown; is_custom_price: boolean; metadata: Metadata | null }
}

const withoutAddons = (metadata: Metadata | null | undefined): Metadata =>
  Object.fromEntries(Object.entries(metadata ?? {}).filter(([key]) => key !== ADDONS_KEY))

/**
 * What an undo writes on the line: the add-ons it had before, or an empty
 * string that takes the key out (none before). Medusa merges a line's
 * metadata (2.21.2), so the undo names its own key only; the whole earlier
 * metadata would write over keys others wrote meanwhile.
 */
export function restoredAddonsMetadata(before: Metadata | null): Metadata {
  return {
    [ADDONS_KEY]: before && Object.hasOwn(before, ADDONS_KEY) ? before[ADDONS_KEY] : "",
  }
}

/**
 * Checks the picks against the line's product and prices them from the
 * cart's own pricing context; writes nothing. Only an open cart of this
 * storefront, a line of a product that has add-ons.
 */
export const planLineAddonsStep = createStep(
  "addons-plan-line",
  async (input: SetLineAddonsInput, { container }) => {
    const cart = await readAddonCart(container, input.cart_id)
    if (
      !cart ||
      cart.completed_at ||
      !input.sales_channel_ids.includes(cart.sales_channel_id ?? "")
    ) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "cart.unknown")
    }
    const line = linesOf(cart).find((item) => item.id === input.line_id)
    if (!line) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "cart.line_unknown")
    }
    const addons = line.product_id
      ? ((await productAddonsAmong(container, [line.product_id])).get(line.product_id) ?? [])
      : []
    if (addons.length === 0) {
      throw new ValidationError("addons.not_addon_line", { field: "line_id" })
    }
    const result = await priceAddonLine(container, cart, line, addons, input.selections)
    if ("problem" in result) {
      throw new ValidationError(result.problem.key, { field: result.problem.field })
    }
    const before = {
      unit_price: line.unit_price,
      is_custom_price: line.is_custom_price === true,
      metadata: line.metadata ?? null,
    }
    const priced = result.priced
    const plan: LinePlan = priced
      ? {
          mode: "set",
          line_id: line.id,
          quantity: priced.quantity,
          unit_price: toMedusaAmount(priced.unit_price),
          compare_at_unit_price:
            priced.compare_at_unit_price === null
              ? null
              : toMedusaAmount(priced.compare_at_unit_price),
          metadata: { ...withoutAddons(line.metadata), [ADDONS_KEY]: priced.addons },
          before,
        }
      : {
          // No picks: a line that had add-ons goes back to the variant's price
          mode: ADDONS_KEY in (line.metadata ?? {}) || before.is_custom_price ? "reset" : "none",
          line_id: line.id,
          quantity: Number(line.quantity),
          unit_price: null,
          compare_at_unit_price: null,
          // Medusa merges metadata: an empty string takes a key out (2.21.2)
          metadata: { [ADDONS_KEY]: "" },
          before,
        }
    return new StepResponse(plan)
  }
)

/**
 * A line back to an ordinary one: no add-ons, no custom price, so the
 * cart's refresh prices it from the variant as Medusa prices any line.
 * Undone, the line's price and add-ons before come back; its other
 * metadata is left as it is.
 */
export const resetLineStep = createStep(
  "addons-reset-line",
  async (plan: LinePlan, { container }) => {
    const carts = container.resolve<ICartModuleService>(Modules.CART)
    await carts.updateLineItems(plan.line_id, { is_custom_price: false, metadata: plan.metadata })
    return new StepResponse(null, plan)
  },
  async (plan, { container }) => {
    if (plan) {
      await container.resolve<ICartModuleService>(Modules.CART).updateLineItems(plan.line_id, {
        is_custom_price: plan.before.is_custom_price,
        unit_price: plan.before.unit_price as number,
        metadata: restoredAddonsMetadata(plan.before.metadata),
      })
    }
  }
)

/**
 * POST /store/carts/:id/line-items/:line_id/addons (adr/0052 §1, §3): the
 * line's add-ons, priced on the server; sent again, they replace the last
 * picks, none sends the line back to the variant's price. Under the
 * cart's lock; Medusa's line update and refresh run nested, without their
 * own lock (2.21.2), and put taxes, promotions and the payment collection
 * right for the new price.
 */
export const setLineAddonsWorkflow = createWorkflow(
  "addons-set-line",
  (input: SetLineAddonsInput) => {
    acquireLockStep({ key: input.cart_id, timeout: 5, ttl: 30 })
    const plan = planLineAddonsStep(input)
    when("addons-set-line-price", { plan }, ({ plan }) => plan.mode === "set").then(() => {
      updateLineItemInCartWorkflow.runAsStep({
        input: transform({ input, plan }, ({ input, plan }) => ({
          cart_id: input.cart_id,
          item_id: plan.line_id,
          update: {
            quantity: plan.quantity,
            unit_price: plan.unit_price ?? "0",
            compare_at_unit_price: clearablePrice(plan.compare_at_unit_price),
            metadata: plan.metadata,
          },
        })),
      })
    })
    when("addons-reset-line-price", { plan }, ({ plan }) => plan.mode === "reset").then(() => {
      resetLineStep(plan)
      refreshCartItemsWorkflow.runAsStep({
        input: transform({ input }, ({ input }) => ({
          cart_id: input.cart_id,
          force_refresh: true,
        })),
      })
    })
    releaseLockStep({ key: input.cart_id })
    return new WorkflowResponse(
      transform({ plan }, ({ plan }) => ({ line_id: plan.line_id, mode: plan.mode }))
    )
  }
)
