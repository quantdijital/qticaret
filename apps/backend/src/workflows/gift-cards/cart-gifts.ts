import type { ICartModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { ValidationError } from "../../lib/errors"
import {
  GIFT_RECIPIENT_KEY,
  giftLineProblem,
  giftRecipientOf,
} from "../../lib/promotions/gift-sale"
import type { GiftCartLine, GiftRecipient } from "../../lib/promotions/gift-sale"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { GIFT_CARDS } from "../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { giftProductsAmong } from "./gift-products"

type Container = Pick<MedusaContainer, "resolve">

interface CartRow {
  id: string
  completed_at?: unknown
  sales_channel_id?: string | null
  items?:
    | ({
        id: string
        product_id?: string | null
        variant_id?: string | null
        metadata?: Record<string, unknown> | null
      } | null)[]
    | null
  credit_lines?: ({ id: string } | null)[] | null
}

async function cartRow(container: Container, cartId: string): Promise<CartRow | undefined> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: [
      "id",
      "completed_at",
      "sales_channel_id",
      "items.id",
      "items.product_id",
      "items.variant_id",
      "items.metadata",
      "credit_lines.id",
    ],
    filters: { id: cartId },
  })
  return data[0]
}

const linesOf = (cart: CartRow): GiftCartLine[] =>
  (cart.items ?? []).flatMap((item) =>
    item ? [{ id: item.id, product_id: item.product_id ?? null, metadata: item.metadata }] : []
  )

/**
 * Stops a payment, or the order, of a cart whose gift lines are not ready
 * (adr/0025 Ek 2026-11-03): gift cards off, a line without its recipient,
 * or gift cards and store credit paying for a gift card. `way` is the way
 * to pay being started, null at completion.
 */
export async function assertGiftLinesReady(
  container: Container,
  cartId: string,
  way: string | null
): Promise<void> {
  const cart = await cartRow(container, cartId)
  if (!cart) {
    return
  }
  const lines = linesOf(cart)
  const giftProducts = await giftProductsAmong(
    container,
    lines.map((line) => line.product_id)
  )
  if (giftProducts.size === 0) {
    return
  }
  const saleOn = await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .isFeatureEnabled(GIFT_CARDS)
  const problem = giftLineProblem({
    lines,
    giftProducts,
    hasCredit: (cart.credit_lines ?? []).some(Boolean),
    way,
    saleOn,
  })
  if (problem) {
    throw new ValidationError(problem.key, { field: problem.field })
  }
}

/** The storefront's cart: its gift lines, each with the recipient it names (null: none yet). */
export async function cartGiftLines(
  container: Container,
  cartId: string,
  salesChannelIds: readonly string[]
) {
  const cart = await cartRow(container, cartId)
  if (!cart || !salesChannelIds.includes(cart.sales_channel_id ?? "")) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "cart.unknown")
  }
  const items = (cart.items ?? []).flatMap((item) => (item ? [item] : []))
  const giftProducts = await giftProductsAmong(
    container,
    items.map((item) => item.product_id)
  )
  return items
    .filter((item) => item.product_id && giftProducts.has(item.product_id))
    .map((item) => ({
      line_id: item.id,
      product_id: item.product_id ?? null,
      variant_id: item.variant_id ?? null,
      recipient: giftRecipientOf(item.metadata),
    }))
}

export interface SetGiftRecipientInput {
  cart_id: string
  line_id: string
  sales_channel_ids: string[]
  gift: GiftRecipient
}

/**
 * Writes the recipient on a gift line of an open cart of this storefront;
 * another line is refused. Undone, the line's metadata before comes back.
 */
const setGiftRecipientStep = createStep(
  "gift-cards-set-recipient",
  async (input: SetGiftRecipientInput, { container }) => {
    const cart = await cartRow(container, input.cart_id)
    if (
      !cart ||
      cart.completed_at ||
      !input.sales_channel_ids.includes(cart.sales_channel_id ?? "")
    ) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "cart.unknown")
    }
    const line = (cart.items ?? []).find((item) => item?.id === input.line_id)
    if (!line) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "cart.line_unknown")
    }
    const gifts = await giftProductsAmong(container, [line.product_id])
    if (!line.product_id || !gifts.has(line.product_id)) {
      throw new ValidationError("gift_card.not_gift_line", { field: "line_id" })
    }
    const before = line.metadata ?? null
    await container.resolve<ICartModuleService>(Modules.CART).updateLineItems(line.id, {
      metadata: { ...(before ?? {}), [GIFT_RECIPIENT_KEY]: input.gift },
    })
    return new StepResponse(
      { line_id: line.id, recipient: input.gift },
      { id: line.id, metadata: before }
    )
  },
  async (undo, { container }) => {
    if (undo) {
      await container
        .resolve<ICartModuleService>(Modules.CART)
        .updateLineItems(undo.id, { metadata: undo.metadata ?? {} })
    }
  }
)

/** A gift line's recipient (adr/0025 Ek 2026-11-03), under the cart's own lock. */
export const setGiftRecipientWorkflow = createWorkflow(
  "gift-cards-set-recipient",
  (input: SetGiftRecipientInput) => {
    acquireLockStep({ key: input.cart_id, timeout: 5, ttl: 30 })
    const result = setGiftRecipientStep(input)
    releaseLockStep({ key: input.cart_id })
    return new WorkflowResponse(result)
  }
)
